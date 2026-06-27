import { AudioState, EffectSettings, ImprovRound } from '../types';

export class SoundImproEngine {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private playbackAnalyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  
  private currentState: AudioState = 'idle';
  private intensity: number = 50; // 0 to 100
  private effectStyle: number = 50; // 0 to 100 (0=natural, 100=synthetic)
  private isRecordingSession: boolean = false;
  private isLooping: boolean = false;
  private isReversed: boolean = false;
  private isFilterEnabled: boolean = true;
  private sessionBuffers: { userBuffer: AudioBuffer; processedBuffer: AudioBuffer }[] = [];
  private lastStates: ImprovRound[] = [];
  
  // Callbacks
  private onStateChange: (state: AudioState, metadata?: any) => void;
  private onVisualsUpdate: (dataArray: Uint8Array, rms: number, isInput: boolean) => void;
  private onRoundComplete: (round: ImprovRound) => void;

  // Silence detection parameters
  private onsetThreshold = 0.022;       // RMS level above which we start recording
  private silenceThreshold = 0.012;     // RMS level below which we consider it silent
  private pauseDurationMs = 1200;       // Continuous silent ms needed to trigger pause end
  private maxRecordingMs = 12000;       // Max recording length to prevent infinite loops (12s)
  private overlapDuration = 0.5;        // Continuous sound overlap in seconds (0 to 2s)
  
  // Real-time tracking
  private isAnalyzing = false;
  private silenceStartTime: number | null = null;
  private recordingStartTime: number | null = null;
  private activeSourceNode: AudioBufferSourceNode | null = null;
  private activeGainNode: GainNode | null = null;
  private lastUserBlobUrl: string | null = null;
  private createdBlobUrls: string[] = [];
  private activeDroneFreqs: number[] = [];
  private droneVolume: number = 0.5; // range 0 to 1
  private roundBuffers = new Map<string, { userBuffer: AudioBuffer; processedBuffer: AudioBuffer }>();
  private activeHistorySources = new Map<string, { source: AudioBufferSourceNode; isLooping: boolean }>();
  private enabledRandomEffects = {
    pitch: true,
    reverb: true,
    delay: true,
    tremolo: true,
    bitcrusher: true,
    ringmod: true,
    distortion: true,
    filter: true,
    flanger: true,
  };

  constructor(
    onStateChange: (state: AudioState, metadata?: any) => void,
    onVisualsUpdate: (dataArray: Uint8Array, rms: number, isInput: boolean) => void,
    onRoundComplete: (round: ImprovRound) => void
  ) {
    this.onStateChange = onStateChange;
    this.onVisualsUpdate = onVisualsUpdate;
    this.onRoundComplete = onRoundComplete;
  }

  public setDroneVolume(vol: number) {
    this.droneVolume = vol;
  }

  public setIntensity(val: number) {
    this.intensity = val;
  }

  public getIntensity(): number {
    return this.intensity;
  }

  public setEnabledRandomEffects(effects: {
    pitch: boolean;
    reverb: boolean;
    delay: boolean;
    tremolo: boolean;
    bitcrusher: boolean;
    ringmod: boolean;
    distortion: boolean;
    filter: boolean;
    flanger: boolean;
  }) {
    this.enabledRandomEffects = effects;
  }

  public setEffectStyle(val: number) {
    this.effectStyle = val;
  }

  public getEffectStyle(): number {
    return this.effectStyle;
  }

  public setRecordingSession(val: boolean) {
    this.isRecordingSession = val;
    if (val) {
      this.clearSessionBuffers();
    }
  }

  public getRecordingSession(): boolean {
    return this.isRecordingSession;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  public updateActiveDrones(freqs: number[]) {
    this.activeDroneFreqs = freqs;
  }

  public playHistoryBuffer(roundId: string, bufferType: 'raw' | 'processed', isLooping: boolean, onEnded: () => void) {
    if (!this.audioContext) return;
    
    const item = this.roundBuffers.get(roundId);
    if (!item) return;

    // Stop existing history playback for this specific round if already active
    this.stopHistoryBuffer(roundId);

    const ctx = this.audioContext;
    const source = ctx.createBufferSource();
    source.buffer = bufferType === 'raw' ? item.userBuffer : item.processedBuffer;
    source.loop = isLooping;
    
    // Connect to playback analyser and audio context destination
    source.connect(this.playbackAnalyser!);
    this.playbackAnalyser!.connect(ctx.destination);
    
    this.activeHistorySources.set(roundId, { source, isLooping });

    // If recording session is active, feed this played sound into the session buffers!
    if (this.isRecordingSession) {
      this.sessionBuffers.push({
        userBuffer: item.userBuffer,
        processedBuffer: item.processedBuffer
      });
    }

    source.onended = () => {
      // Only trigger onEnded if it wasn't stopped manually
      if (this.activeHistorySources.has(roundId)) {
        this.activeHistorySources.delete(roundId);
        onEnded();
      }
    };

    source.start(0);
  }

  public stopHistoryBuffer(roundId: string) {
    const active = this.activeHistorySources.get(roundId);
    if (active) {
      try {
        active.source.stop();
      } catch (e) {}
      this.activeHistorySources.delete(roundId);
    }
  }

  public stopAllHistoryBuffers() {
    this.activeHistorySources.forEach((active, roundId) => {
      try {
        active.source.stop();
      } catch (e) {}
    });
    this.activeHistorySources.clear();
  }

  public setHistoryBufferLooping(roundId: string, isLooping: boolean) {
    const active = this.activeHistorySources.get(roundId);
    if (active) {
      active.source.loop = isLooping;
      active.isLooping = isLooping;
    }
  }

  public setLooping(val: boolean) {
    this.isLooping = val;
    if (this.activeSourceNode) {
      this.activeSourceNode.loop = val;
    }
  }

  public skipReplyingAndStartNewRound() {
    if (this.currentState === 'playing_answer' && this.activeSourceNode) {
      const ctx = this.audioContext;
      const gainNode = this.activeGainNode;
      const sourceNode = this.activeSourceNode;
      
      this.activeSourceNode = null;
      this.activeGainNode = null;
      
      if (ctx && gainNode) {
        try {
          // Smooth, ultra-fast 25ms fade out to prevent clicks/clipping
          gainNode.gain.cancelScheduledValues(ctx.currentTime);
          gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.025);
          sourceNode.stop(ctx.currentTime + 0.03);
        } catch (e) {
          try {
            sourceNode.stop();
          } catch (err) {}
        }
      } else {
        try {
          sourceNode.stop();
        } catch (e) {}
      }
    }
  }

  public getLooping(): boolean {
    return this.isLooping;
  }

  public setReversed(val: boolean) {
    this.isReversed = val;
  }

  public getReversed(): boolean {
    return this.isReversed;
  }

  public setFilterEnabled(val: boolean) {
    this.isFilterEnabled = val;
  }

  public getFilterEnabled(): boolean {
    return this.isFilterEnabled;
  }

  public setOnsetThreshold(val: number) {
    this.onsetThreshold = val;
  }

  public getOnsetThreshold(): number {
    return this.onsetThreshold;
  }

  public setSilenceThreshold(val: number) {
    this.silenceThreshold = val;
  }

  public getSilenceThreshold(): number {
    return this.silenceThreshold;
  }

  public setPauseDurationMs(val: number) {
    this.pauseDurationMs = val;
  }

  public getPauseDurationMs(): number {
    return this.pauseDurationMs;
  }

  public setOverlapDuration(val: number) {
    this.overlapDuration = val;
  }

  public getOverlapDuration(): number {
    return this.overlapDuration;
  }

  public clearSessionBuffers() {
    this.sessionBuffers = [];
    this.roundBuffers.clear();
    this.stopAllHistoryBuffers();
  }

  public getSessionBuffersCount(): number {
    return this.sessionBuffers.length;
  }

  public getCurrentState(): AudioState {
    return this.currentState;
  }

  public async processCustomAudioFile(blob: Blob) {
    if (this.currentState === 'idle') {
      await this.start();
    }
    await this.processAndReply(blob);
  }

  private changeState(state: AudioState, metadata?: any) {
    this.currentState = state;
    this.onStateChange(state, metadata);
  }

  /**
   * Initializes AudioContext and starts listening
   */
  public async start() {
    if (this.currentState !== 'idle') return;
    this.changeState('initializing');

    try {
      // 1. Get audio media stream
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        },
        video: false
      });

      // 2. Initialize AudioContext
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      
      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 3. Setup Mic Source and Analyser
      this.micSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.micAnalyser = this.audioContext.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.micSource.connect(this.micAnalyser);

      // Setup Playback Analyser
      this.playbackAnalyser = this.audioContext.createAnalyser();
      this.playbackAnalyser.fftSize = 256;

      // 4. Start analysis loop
      this.isAnalyzing = true;
      this.loop();

      // 5. Ready - waiting for first user sound
      this.changeState('waiting_for_sound');
    } catch (err) {
      console.error('Failed to initialize audio engine:', err);
      this.stop();
      throw err;
    }
  }

  /**
   * Stops the engine entirely and cleans up resources
   */
  public stop() {
    this.isAnalyzing = false;
    
    // Stop recording if active
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
    }
    
    // Stop active playback if running
    if (this.activeSourceNode) {
      try {
        this.activeSourceNode.stop();
      } catch (e) {}
      this.activeSourceNode = null;
    }
    this.activeGainNode = null;

    // Stop and release media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close AudioContext
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    // Clean up urls
    this.createdBlobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {}
    });
    this.createdBlobUrls = [];
    this.lastUserBlobUrl = null;

    this.stopAllHistoryBuffers();

    this.micSource = null;
    this.micAnalyser = null;
    this.playbackAnalyser = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.silenceStartTime = null;
    this.recordingStartTime = null;

    this.changeState('idle');
  }

  /**
   * Procedural real-time analysis loop
   */
  private loop = () => {
    if (!this.isAnalyzing) return;
    requestAnimationFrame(this.loop);

    // If we are waiting for sound, recording sound, or processing, we analyze mic input.
    // Otherwise, we analyze the playback for visualization and feedback cancellation.
    const isPlayback = this.currentState === 'playing_answer';
    const activeAnalyser = isPlayback ? this.playbackAnalyser : this.micAnalyser;

    if (!activeAnalyser) return;

    // Measure volume (RMS)
    const bufferLength = activeAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    activeAnalyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const val = (dataArray[i] - 128) / 128; // Normalize to -1..1
      sum += val * val;
    }
    const rms = Math.sqrt(sum / bufferLength);

    // Call visual callback for UI animations
    this.onVisualsUpdate(dataArray, rms, !isPlayback);

    const now = Date.now();

    // Measure playback volume if any playback is currently active
    let playbackRms = 0;
    if (this.playbackAnalyser && this.activeSourceNode) {
      const pBufferLength = this.playbackAnalyser.frequencyBinCount;
      const pDataArray = new Uint8Array(pBufferLength);
      this.playbackAnalyser.getByteTimeDomainData(pDataArray);
      let pSum = 0;
      for (let i = 0; i < pBufferLength; i++) {
        const val = (pDataArray[i] - 128) / 128;
        pSum += val * val;
      }
      playbackRms = Math.sqrt(pSum / pBufferLength);
    }

    // Monitor microphone input during playback to detect new user sounds
    if (isPlayback && this.micAnalyser && playbackRms > 0) {
      const micBufferLength = this.micAnalyser.frequencyBinCount;
      const micDataArray = new Uint8Array(micBufferLength);
      this.micAnalyser.getByteTimeDomainData(micDataArray);
      let micSum = 0;
      for (let i = 0; i < micBufferLength; i++) {
        const val = (micDataArray[i] - 128) / 128;
        micSum += val * val;
      }
      const micRms = Math.sqrt(micSum / micBufferLength);
      
      // Dynamic threshold slightly higher than standard onset to prevent speaker bleed-through, but still very responsive
      const dynamicThreshold = Math.max(this.onsetThreshold * 1.3, 0.035) + playbackRms * 0.40;
      if (micRms > dynamicThreshold) {
        this.skipReplyingAndStartNewRound();
        return;
      }
    }

    // Sound Onset & Silence detection state machine
    if (this.currentState === 'waiting_for_sound') {
      // Filter out the sound of the audible playback of the reply when starting a new sound
      const dynamicOnsetThreshold = this.onsetThreshold + playbackRms * 0.75;

      if (rms > dynamicOnsetThreshold) {
        // Sound has started! Trigger recording.
        // If there was a playing answer in the background, fade it out quickly
        if (this.activeSourceNode && this.activeGainNode) {
          const ctx = this.audioContext;
          if (ctx) {
            try {
              this.activeGainNode.gain.cancelScheduledValues(ctx.currentTime);
              this.activeGainNode.gain.setValueAtTime(this.activeGainNode.gain.value, ctx.currentTime);
              this.activeGainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
              this.activeSourceNode.stop(ctx.currentTime + 0.16);
            } catch (e) {}
          }
        }
        this.startRecordingChunks();
      }
    } else if (this.currentState === 'recording_sound') {
      // Check maximum duration safeguard
      const elapsed = now - (this.recordingStartTime || now);
      if (elapsed >= this.maxRecordingMs) {
        this.stopRecordingChunks();
        return;
      }

      // Check silence pause detection
      if (rms < this.silenceThreshold) {
        if (this.silenceStartTime === null) {
          this.silenceStartTime = now;
        } else {
          const silentDuration = now - this.silenceStartTime;
          if (silentDuration >= this.pauseDurationMs) {
            // Silence has lasted long enough! Stop recording and reply
            this.stopRecordingChunks();
          }
        }
      } else {
        // Sound is active, reset silence counter
        this.silenceStartTime = null;
      }
    }
  };

  /**
   * Public manual recording controllers
   */
  public startRecordingManually() {
    if (this.currentState === 'waiting_for_sound') {
      this.startRecordingChunks();
    }
  }

  public stopRecordingManually() {
    if (this.currentState === 'recording_sound') {
      this.stopRecordingChunks();
    }
  }

  /**
   * Starts capturing chunks and enters recording state
   */
  private startRecordingChunks() {
    if (!this.mediaStream || !this.audioContext) return;
    
    this.recordedChunks = [];
    this.silenceStartTime = null;
    this.recordingStartTime = Date.now();
    
    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        await this.processAndReply(rawBlob);
      };

      this.mediaRecorder.start();
      this.changeState('recording_sound');
    } catch (err) {
      console.error('Failed to start media recorder:', err);
      this.changeState('waiting_for_sound'); // Fallback
    }
  }

  /**
   * Stops the active media recorder
   */
  private stopRecordingChunks() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.error('Error stopping recorder:', err);
        this.changeState('waiting_for_sound');
      }
    } else {
      this.changeState('waiting_for_sound');
    }
  }

  /**
   * Decodes raw recorded blob, generates musical effects, and initiates playbacks
   */
  private async processAndReply(blob: Blob) {
    if (!this.audioContext) return;
    this.changeState('processing');

    try {
      // Convert Blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      
      // Decode audio data
      const rawBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Ensure the buffer is valid
      if (rawBuffer.duration < 0.1) {
        // Sound too short or empty background click, return to waiting
        this.changeState('waiting_for_sound');
        return;
      }

      // Create local URL of the user's recorded audio for downloading/saving (using standard WAV for universal browser support)
      const wavBlob = this.bufferToWav(rawBuffer);
      const url = URL.createObjectURL(wavBlob);
      this.lastUserBlobUrl = url;
      this.createdBlobUrls.push(url);

      // Procedurally select effects based on intensity & style
      const { settings, names } = this.generateRandomEffects(this.intensity, this.effectStyle);

      // Render the processed buffer offline (extremely fast and CPU-safe!)
      const processedBuffer = await this.renderProcessedBuffer(rawBuffer, settings);

      // Save buffers if session recording is active
      if (this.isRecordingSession) {
        this.sessionBuffers.push({ userBuffer: rawBuffer, processedBuffer });
      }

      // Generate a stable, unique roundId and register it in roundBuffers so it is always play-backable
      const roundId = Math.random().toString(36).substring(2, 9);
      this.roundBuffers.set(roundId, { userBuffer: rawBuffer, processedBuffer });

      // Trigger pre-rendered direct playback (ensures perfect fidelity!)
      this.playProcessedBufferDirect(processedBuffer, rawBuffer.duration, settings, names, roundId, url);

    } catch (err) {
      console.error('Error decoding/processing sound reply:', err);
      // Wait 1 second and return to recording
      setTimeout(() => {
        if (this.currentState === 'processing') {
          this.changeState('waiting_for_sound');
        }
      }, 1000);
    }
  }

  /**
   * Renders the user's audio buffer through our effects graph using an OfflineAudioContext
   */
  private async renderProcessedBuffer(userBuffer: AudioBuffer, settings: EffectSettings): Promise<AudioBuffer> {
    const ctx = this.audioContext;
    if (!ctx) return userBuffer;

    // Pitch shifting changes output duration
    const targetLength = Math.max(1, Math.floor(userBuffer.length / settings.pitchRate));
    
    // Add 4.5 seconds (or more if overlapping) of tail for reverb/delay/echo to decay naturally!
    const extraTailSec = this.overlapDuration > 0 ? (4.5 + this.overlapDuration * 2.0) : 4.5;
    const tailSamples = Math.floor(ctx.sampleRate * extraTailSec);
    const totalLength = targetLength + tailSamples;
    
    const offlineCtx = new OfflineAudioContext(
      userBuffer.numberOfChannels,
      totalLength,
      ctx.sampleRate
    );

    // 1. Create Source Node
    const source = offlineCtx.createBufferSource();
    source.buffer = userBuffer;
    source.playbackRate.value = settings.pitchRate;

    // 2. Setup Nodes for each effect
    const finalChain: AudioNode[] = [];

    // [EFFECT] Tremolo (volume LFO modulation)
    if (settings.tremoloDepth > 0) {
      const tremoloGain = offlineCtx.createGain();
      tremoloGain.gain.value = 1.0 - settings.tremoloDepth * 0.5; // scale offset

      const tremoloLfo = offlineCtx.createOscillator();
      tremoloLfo.frequency.value = settings.tremoloRate;

      const tremoloLfoGain = offlineCtx.createGain();
      tremoloLfoGain.gain.value = settings.tremoloDepth * 0.5;

      tremoloLfo.connect(tremoloLfoGain);
      tremoloLfoGain.connect(tremoloGain.gain);
      tremoloLfo.start();
      finalChain.push(tremoloGain);
    }

    // [EFFECT] Bitcrusher (sample rate & bit reduction wave-shaper)
    if (settings.bitcrusherWet > 0) {
      const bcNode = offlineCtx.createWaveShaper();
      bcNode.curve = this.makeBitcrusherCurve(settings.bitcrusherBits);
      bcNode.oversample = 'none';

      const bcDry = offlineCtx.createGain();
      bcDry.gain.value = 1.0 - settings.bitcrusherWet;
      const bcWet = offlineCtx.createGain();
      bcWet.gain.value = settings.bitcrusherWet;

      const bcSplit = offlineCtx.createGain();
      const bcMerge = offlineCtx.createGain();

      bcSplit.connect(bcDry);
      bcDry.connect(bcMerge);

      bcSplit.connect(bcNode);
      bcNode.connect(bcWet);
      bcWet.connect(bcMerge);

      finalChain.push(bcSplit);
      finalChain.push(bcMerge);
    }

    // [EFFECT] Space Flanger (swept delay comb filter)
    if (settings.flangerWet > 0) {
      const flangerSplit = offlineCtx.createGain();
      const flangerMerge = offlineCtx.createGain();

      const flangerDelay = offlineCtx.createDelay(0.1);
      flangerDelay.delayTime.value = 0.003; // 3ms base delay

      const flangerLfo = offlineCtx.createOscillator();
      flangerLfo.frequency.value = settings.flangerRate;

      const flangerLfoGain = offlineCtx.createGain();
      flangerLfoGain.gain.value = settings.flangerDepth;

      flangerLfo.connect(flangerLfoGain);
      flangerLfoGain.connect(flangerDelay.delayTime);
      flangerLfo.start();

      const flangerFeedback = offlineCtx.createGain();
      flangerFeedback.gain.value = 0.7; // deep flanging resonance

      const flangerWet = offlineCtx.createGain();
      flangerWet.gain.value = settings.flangerWet;

      const flangerDry = offlineCtx.createGain();
      flangerDry.gain.value = 1.0 - settings.flangerWet * 0.5;

      // Connections
      flangerSplit.connect(flangerDry);
      flangerDry.connect(flangerMerge);

      flangerSplit.connect(flangerDelay);
      flangerDelay.connect(flangerFeedback);
      flangerFeedback.connect(flangerDelay);

      flangerDelay.connect(flangerWet);
      flangerWet.connect(flangerMerge);

      finalChain.push(flangerSplit);
      finalChain.push(flangerMerge);
    }

    // [EFFECT] Tape Vibrato (pitch modulation / tape wow & flutter)
    if (settings.vibratoWet > 0) {
      const vibratoSplit = offlineCtx.createGain();
      const vibratoMerge = offlineCtx.createGain();

      const vibratoDelay = offlineCtx.createDelay(0.1);
      vibratoDelay.delayTime.value = 0.005; // 5ms baseline delay

      const vibratoLfo = offlineCtx.createOscillator();
      vibratoLfo.frequency.value = settings.vibratoRate;

      const vibratoLfoGain = offlineCtx.createGain();
      vibratoLfoGain.gain.value = settings.vibratoDepth;

      vibratoLfo.connect(vibratoLfoGain);
      vibratoLfoGain.connect(vibratoDelay.delayTime);
      vibratoLfo.start();

      const vibratoDry = offlineCtx.createGain();
      vibratoDry.gain.value = 1.0 - settings.vibratoWet * 0.5;
      const vibratoWet = offlineCtx.createGain();
      vibratoWet.gain.value = settings.vibratoWet;

      vibratoSplit.connect(vibratoDry);
      vibratoDry.connect(vibratoMerge);

      vibratoSplit.connect(vibratoDelay);
      vibratoDelay.connect(vibratoWet);
      vibratoWet.connect(vibratoMerge);

      finalChain.push(vibratoSplit);
      finalChain.push(vibratoMerge);
    }

    // [EFFECT] Ring Modulator (metallic robot effect)
    if (settings.ringModWet > 0) {
      const ringModGain = offlineCtx.createGain();
      ringModGain.gain.value = 0; // modulated by oscillator

      const ringModOsc = offlineCtx.createOscillator();
      ringModOsc.frequency.value = settings.ringModFreq;
      
      const ringModDry = offlineCtx.createGain();
      ringModDry.gain.value = 1.0 - settings.ringModWet;
      const ringModWet = offlineCtx.createGain();
      ringModWet.gain.value = settings.ringModWet;

      // Setup oscillator to modulate the gain node
      ringModOsc.connect(ringModGain.gain);
      ringModOsc.start();

      // Parallel paths
      const splitNode = offlineCtx.createGain();
      const mergeNode = offlineCtx.createGain();

      splitNode.connect(ringModDry);
      ringModDry.connect(mergeNode);

      splitNode.connect(ringModGain);
      ringModGain.connect(ringModWet);
      ringModWet.connect(mergeNode);

      finalChain.push(splitNode);
      finalChain.push(mergeNode);
    }

    // [EFFECT] Distortion
    if (settings.distortionAmount > 0) {
      const distNode = offlineCtx.createWaveShaper();
      distNode.curve = this.makeDistortionCurve(settings.distortionAmount);
      distNode.oversample = '4x';
      finalChain.push(distNode);
    }

    // [EFFECT] Biquad Filter (telephone/underwater radio)
    if (settings.filterType !== 'none') {
      const filterNode = offlineCtx.createBiquadFilter();
      filterNode.type = settings.filterType;
      filterNode.frequency.value = settings.filterFrequency;
      finalChain.push(filterNode);
    }

    // [EFFECT] Echo / Feedback Delay
    if (settings.delayWet > 0) {
      const delaySplit = offlineCtx.createGain();
      const delayMerge = offlineCtx.createGain();
      
      const feedbackDelay = offlineCtx.createDelay(3.0);
      feedbackDelay.delayTime.value = settings.delayTime;

      const feedback = offlineCtx.createGain();
      feedback.gain.value = settings.delayFeedback;

      const delayWet = offlineCtx.createGain();
      delayWet.gain.value = settings.delayWet;

      const delayDry = offlineCtx.createGain();
      delayDry.gain.value = 1.0 - settings.delayWet * 0.3;

      // Wire feedback delay
      delaySplit.connect(delayDry);
      delayDry.connect(delayMerge);

      delaySplit.connect(feedbackDelay);
      feedbackDelay.connect(feedback);
      feedback.connect(feedbackDelay); // loop
      
      feedbackDelay.connect(delayWet);
      delayWet.connect(delayMerge);

      finalChain.push(delaySplit);
      finalChain.push(delayMerge);
    }

    // [EFFECT] Lush Reverb (Convolution reverb generated dynamically!)
    if (settings.reverbWet > 0) {
      const convolverNode = offlineCtx.createConvolver();
      // Generate decaying white noise impulse response
      convolverNode.buffer = this.createReverbImpulse(ctx, 2.2, 3.5);

      const revSplit = offlineCtx.createGain();
      const revMerge = offlineCtx.createGain();

      const revDry = offlineCtx.createGain();
      revDry.gain.value = 1.0 - settings.reverbWet * 0.4;

      const revWet = offlineCtx.createGain();
      revWet.gain.value = settings.reverbWet;

      revSplit.connect(revDry);
      revDry.connect(revMerge);

      revSplit.connect(convolverNode);
      convolverNode.connect(revWet);
      revWet.connect(revMerge);

      finalChain.push(revSplit);
      finalChain.push(revMerge);
    }

    // 3. Connect Nodes in series
    let lastNode: AudioNode = source;
    finalChain.forEach(node => {
      lastNode.connect(node);
      lastNode = node;
    });

    // 4. Connect to Master output of offline context
    lastNode.connect(offlineCtx.destination);

    // [EFFECT] Granular Overlapping Loop & Random long lasting effects
    if (this.overlapDuration > 0) {
      // 1. Randomly enhance long-lasting reverb and delay wet mixes to create a lush, atmospheric background
      if (settings.reverbWet > 0) {
        settings.reverbWet = Math.min(1.0, settings.reverbWet + this.overlapDuration * 0.15);
      }
      if (settings.delayWet > 0) {
        settings.delayWet = Math.min(1.0, settings.delayWet + this.overlapDuration * 0.15);
        settings.delayFeedback = Math.min(0.88, settings.delayFeedback + this.overlapDuration * 0.1);
      }

      // 2. Loop granular parts of the recording at the end to form a continuous transition
      const sliceStart = Math.max(0, userBuffer.duration - 0.35);
      const sliceDuration = Math.min(0.3, userBuffer.duration - sliceStart);
      
      if (sliceDuration > 0.05) {
        const grainCount = Math.floor(this.overlapDuration * 5); // 5 grains per second of overlap
        for (let g = 0; g < grainCount; g++) {
          const grainSource = offlineCtx.createBufferSource();
          grainSource.buffer = userBuffer;
          // Slight pitch variations for rich texturing
          grainSource.playbackRate.value = settings.pitchRate * (0.9 + Math.random() * 0.2);
          
          const grainGain = offlineCtx.createGain();
          const grainStartOffset = (targetLength / ctx.sampleRate) + g * 0.22; // staggered timing
          const volumeScale = Math.max(0.1, 1.0 - (g / grainCount));
          
          grainGain.gain.setValueAtTime(0, offlineCtx.currentTime);
          grainGain.gain.setValueAtTime(0, offlineCtx.currentTime + grainStartOffset);
          grainGain.gain.linearRampToValueAtTime(0.25 * volumeScale, offlineCtx.currentTime + grainStartOffset + 0.01);
          grainGain.gain.setValueAtTime(0.25 * volumeScale, offlineCtx.currentTime + grainStartOffset + 0.15);
          grainGain.gain.linearRampToValueAtTime(0, offlineCtx.currentTime + grainStartOffset + 0.22);
          
          grainSource.connect(grainGain);
          
          if (finalChain.length > 0) {
            grainGain.connect(finalChain[0]);
          } else {
            grainGain.connect(offlineCtx.destination);
          }
          
          grainSource.start(offlineCtx.currentTime + grainStartOffset, sliceStart, sliceDuration);
        }
      }
    }

    // 5. Start source and render
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return this.normalizeBuffer(rendered, 0.90);
  }

  /**
   * Normalizes an AudioBuffer so that its peak amplitude matches the targetPeak value.
   * This ensures a consistent, rich, and highly audible playback volume.
   */
  private normalizeBuffer(buffer: AudioBuffer, targetPeak: number = 0.90): AudioBuffer {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    
    // Find current peak across all channels
    let maxVal = 0;
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        const absVal = Math.abs(data[i]);
        if (absVal > maxVal) {
          maxVal = absVal;
        }
      }
    }
    
    // Scale if we have sound and it is quieter than the target
    if (maxVal > 0.001 && maxVal < targetPeak) {
      const scaleFactor = targetPeak / maxVal;
      for (let c = 0; c < channels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
          data[i] *= scaleFactor;
        }
      }
    }
    
    return buffer;
  }

  /**
   * Plays back the pre-rendered processed AudioBuffer directly through the visualizer & audio output
   */
  private playProcessedBufferDirect(
    processedBuffer: AudioBuffer,
    originalDurationSec: number,
    settings: EffectSettings,
    effectNames: string[],
    roundId: string,
    specificUserBlobUrl: string
  ) {
    const ctx = this.audioContext;
    if (!ctx) return;

    this.changeState('playing_answer', { effects: effectNames });

    // 1. Create Playback Buffer (Clone and reverse active spoken region only if requested)
    let playbackBuffer = processedBuffer;
    if (this.isReversed) {
      const channels = processedBuffer.numberOfChannels;
      const sampleRate = processedBuffer.sampleRate;
      
      // Reverse only the active spoken region (calculated from original duration)
      // to keep the beautiful decay tail intact at the end! This fixes the reverse silence bug.
      const activeSec = originalDurationSec / settings.pitchRate;
      const targetLength = Math.min(processedBuffer.length, Math.floor(sampleRate * activeSec));
      
      const reversedBuffer = ctx.createBuffer(channels, processedBuffer.length, sampleRate);
      for (let c = 0; c < channels; c++) {
        const srcData = processedBuffer.getChannelData(c);
        const destData = reversedBuffer.getChannelData(c);
        
        const activeData = srcData.subarray(0, targetLength);
        const activeReversed = new Float32Array(activeData);
        activeReversed.reverse();
        
        destData.set(activeReversed, 0);
        if (processedBuffer.length > targetLength) {
          destData.set(srcData.subarray(targetLength), targetLength);
        }
      }
      playbackBuffer = reversedBuffer;
    }

    // 2. Create Source Node
    const source = ctx.createBufferSource();
    source.buffer = playbackBuffer;
    
    // Configure looping
    if (this.isLooping) {
      source.loop = true;
    }
    this.activeSourceNode = source;

    // 3. Connect directly to Playback Analyser and Master Output
    const masterGain = ctx.createGain();
    this.activeGainNode = masterGain;
    
    // Set initial gain to 0.0 and fade in quickly to prevent starting clicks/pops
    masterGain.gain.setValueAtTime(0.0, ctx.currentTime);
    const fadeInDuration = 0.02;
    masterGain.gain.linearRampToValueAtTime(0.95, ctx.currentTime + fadeInDuration);
    
    const totalDuration = playbackBuffer.duration;
    // We want to stop the reply early if it has a long tail, to transition back to recording faster.
    // However, we want to let the effects like echo play and decay nicely.
    const processedDuration = originalDurationSec / settings.pitchRate;
    const maxPlayDuration = Math.min(totalDuration, Math.max(processedDuration + 0.4, 1.2));
    
    source.connect(this.playbackAnalyser!);
    this.playbackAnalyser!.connect(masterGain);
    masterGain.connect(ctx.destination);

    // 3. Playback Completion Handler
    source.onended = () => {
      // Record round completion stats using the exact, stable pre-generated ID
      const round: ImprovRound = {
        id: roundId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        durationSec: parseFloat((originalDurationSec / settings.pitchRate).toFixed(1)),
        effectsApplied: effectNames.length > 0 ? effectNames : ['Clean Audio Only'],
        intensity: this.intensity,
        userAudioUrl: specificUserBlobUrl || undefined
      };
      
      this.lastStates = [round, ...this.lastStates].slice(0, 10);
      this.onRoundComplete(round);

      // Automatically transition back to recording mode (Continuous improvisation!)
      if (this.currentState === 'playing_answer') {
        this.changeState('waiting_for_sound');
      }
    };

    // Start playback first so we can safely schedule stopping it
    source.start(0);

    // If overlapping is requested, trigger the early transition state change
    // while keeping the background audio playing and fading beautifully
    if (!this.isLooping && this.overlapDuration > 0) {
      const transitionDelayMs = Math.max(100, (maxPlayDuration - this.overlapDuration) * 1000);
      setTimeout(() => {
        if (this.currentState === 'playing_answer') {
          this.changeState('waiting_for_sound');
        }
      }, transitionDelayMs);
    }

    if (!this.isLooping) {
      const fadeOutDuration = 0.15;
      const fadeOutStart = maxPlayDuration - fadeOutDuration;
      
      // Schedule the smooth fade-out
      masterGain.gain.setValueAtTime(0.95, ctx.currentTime + fadeOutStart);
      masterGain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + maxPlayDuration);
      
      // Stop the source exactly at maxPlayDuration to trigger onended faster!
      source.stop(ctx.currentTime + maxPlayDuration);
    }
  }

  /**
   * Encodes a standard AudioBuffer into a pristine, playable 16-bit PCM RIFF/WAV Blob
   */
  private bufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    let result;
    if (numOfChan === 2) {
      result = this.interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
      result = buffer.getChannelData(0);
    }
    
    const bufferLength = result.length * 2; // 2 bytes per sample
    const arrayBuffer = new ArrayBuffer(44 + bufferLength);
    const view = new DataView(arrayBuffer);
    
    // RIFF identifier
    this.writeString(view, 0, 'RIFF');
    // file length
    view.setUint32(4, 36 + bufferLength, true);
    // RIFF type
    this.writeString(view, 8, 'WAVE');
    // format chunk identifier
    this.writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numOfChan, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, numOfChan * (bitDepth / 8), true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    this.writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, bufferLength, true);
    
    // Write PCM audio data
    let offset = 44;
    for (let i = 0; i < result.length; i++) {
      let sample = result[i];
      // Clamp to -1..1
      if (sample > 1.0) sample = 1.0;
      else if (sample < -1.0) sample = -1.0;
      
      const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, pcmSample, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  private interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;
    
    while (index < length) {
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Merges an array of buffers by concatenating them in sequence
   */
  private concatenateBuffers(buffers: AudioBuffer[]): AudioBuffer | null {
    if (buffers.length === 0 || !this.audioContext) return null;
    
    const sampleRate = this.audioContext.sampleRate;
    const channels = buffers[0].numberOfChannels;
    let totalLength = 0;
    
    buffers.forEach(b => {
      totalLength += b.length;
    });

    const outBuffer = this.audioContext.createBuffer(
      channels,
      totalLength,
      sampleRate
    );

    for (let channel = 0; channel < channels; channel++) {
      const channelData = outBuffer.getChannelData(channel);
      let offset = 0;
      buffers.forEach(b => {
        if (channel < b.numberOfChannels) {
          channelData.set(b.getChannelData(channel), offset);
        }
        offset += b.length;
      });
    }

    return outBuffer;
  }

  /**
   * Generates a fully compiled session of alternating raw inputs and processed outputs with clean gaps
   */
  private concatenateSessionAlternating(): AudioBuffer | null {
    if (this.sessionBuffers.length === 0 || !this.audioContext) return null;
    
    const sampleRate = this.audioContext.sampleRate;
    const channels = this.sessionBuffers[0].userBuffer.numberOfChannels;
    const gapSamples = Math.floor(sampleRate * 0.8); // 800ms natural breath gap

    let totalLength = 0;
    this.sessionBuffers.forEach((item) => {
      totalLength += item.userBuffer.length + gapSamples + item.processedBuffer.length + gapSamples;
    });

    const outBuffer = this.audioContext.createBuffer(
      channels,
      totalLength,
      sampleRate
    );

    for (let channel = 0; channel < channels; channel++) {
      const channelData = outBuffer.getChannelData(channel);
      let offset = 0;
      this.sessionBuffers.forEach((item) => {
        // 1. User original recording
        if (channel < item.userBuffer.numberOfChannels) {
          channelData.set(item.userBuffer.getChannelData(channel), offset);
        }
        offset += item.userBuffer.length;

        // 2. Silence Gap
        offset += gapSamples;

        // 3. Effect response
        if (channel < item.processedBuffer.numberOfChannels) {
          channelData.set(item.processedBuffer.getChannelData(channel), offset);
        }
        offset += item.processedBuffer.length;

        // 4. Silence Gap
        offset += gapSamples;
      });
    }

    return outBuffer;
  }

  // PUBLIC EXPORTS FOR USER DOWNLOADS

  /**
   * Concatenates all real user recordings and returns as a WAV Blob
   */
  public getRawSessionWav(): Blob | null {
    const rawBuffers = this.sessionBuffers.map(item => item.userBuffer);
    const concatenated = this.concatenateBuffers(rawBuffers);
    return concatenated ? this.bufferToWav(concatenated) : null;
  }

  /**
   * Concatenates all processed effects answers and returns as a WAV Blob
   */
  public getProcessedSessionWav(): Blob | null {
    const processedBuffers = this.sessionBuffers.map(item => item.processedBuffer);
    const concatenated = this.concatenateBuffers(processedBuffers);
    return concatenated ? this.bufferToWav(concatenated) : null;
  }

  private mixDroneBackground(buffer: AudioBuffer) {
    if (this.activeDroneFreqs.length === 0 || this.droneVolume === 0) return;
    
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    
    for (let channel = 0; channel < channels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        let droneSum = 0;
        
        for (const f of this.activeDroneFreqs) {
          const period = 1 / f;
          const phase = (t % period) / period;
          let val = 0;
          if (phase < 0.25) {
            val = phase * 4;
          } else if (phase < 0.75) {
            val = 2 - phase * 4;
          } else {
            val = phase * 4 - 4;
          }
          droneSum += val * 0.08 * this.droneVolume; // scaled background volume
        }
        
        let mixed = channelData[i] + droneSum;
        if (mixed > 1.0) mixed = 1.0;
        if (mixed < -1.0) mixed = -1.0;
        channelData[i] = mixed;
      }
    }
  }

  /**
   * Generates a pristine alternating mix of the full session
   */
  public getWholeSessionWav(): Blob | null {
    const concatenated = this.concatenateSessionAlternating();
    if (concatenated) {
      this.mixDroneBackground(concatenated);
      return this.bufferToWav(concatenated);
    }
    return null;
  }

  /**
   * Generates a procedurally decaying white-noise impulse response buffer for beautiful reverbs
   */
  private createReverbImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const noise = Math.random() * 2 - 1;
        // Exponentially decaying noise simulates space reverb tail
        channelData[i] = noise * Math.exp(-t * decay);
      }
    }
    return impulse;
  }

  /**
   * Calculates distortion curve buffer for WaveShaperNode
   */
  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Calculates a bit reduction quantizing curve buffer for WaveShaperNode (Bitcrusher)
   */
  private makeBitcrusherCurve(bits: number): Float32Array {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const steps = Math.pow(2, bits);
    for (let i = 0; i < n_samples; i++) {
      const x = (i * 2) / n_samples - 1;
      // Quantize x to steps
      curve[i] = Math.round(x * (steps / 2)) / (steps / 2);
    }
    return curve;
  }

  /**
   * Generates randomized effect parameters based on the intensity and effect style sliders.
   * effectStyle: 0 = 100% natural, organic effects (reverb, echo, lowpass)
   *             100 = 100% synthetic, digital, robotic effects (chipmunk, alien, distortion, ring mod)
   */
  private generateRandomEffects(intensity: number, style: number): { settings: EffectSettings; names: string[] } {
    const settings: EffectSettings = {
      pitchRate: 1.0,
      reverbWet: 0,
      delayTime: 0.35,
      delayFeedback: 0.4,
      delayWet: 0,
      distortionAmount: 0,
      filterType: 'none',
      filterFrequency: 1000,
      ringModFreq: 80,
      ringModWet: 0,
      tremoloRate: 6.0,
      tremoloDepth: 0,
      bitcrusherWet: 0,
      bitcrusherBits: 8,
      flangerRate: 1.0,
      flangerDepth: 0.002,
      flangerWet: 0,
      vibratoRate: 5.5,
      vibratoDepth: 0.002,
      vibratoWet: 0
    };

    const names: string[] = [];

    if (intensity === 0) {
      return { settings, names: ['Clean Feed ✨'] };
    }

    const roll = (prob: number) => Math.random() < prob;

    // 1. Pitch Shift / Speed effect (highly favored on synthetic style)
    if (this.enabledRandomEffects.pitch) {
      const pitchProb = (0.15 + (style / 100) * 0.75) * (intensity / 100);
      if (roll(pitchProb)) {
        if (style > 50) {
          // Extreme / synthetic pitches
          if (Math.random() < 0.5) {
            settings.pitchRate = 0.5; // extreme deep giant
            names.push('Alien Giant 👹');
          } else {
            settings.pitchRate = 2.0; // extreme hyper chipmunk
            names.push('Hyper Chipmunk 🐿️');
          }
        } else {
          // Natural / mild speed fluctuations
          if (Math.random() < 0.5) {
            settings.pitchRate = 0.8;
            names.push('Slower Speed ⬇️');
          } else {
            settings.pitchRate = 1.3;
            names.push('Faster Speed ⬆️');
          }
        }
      }
    }

    // 2. Lush Reverb (highly favored on natural style)
    if (this.enabledRandomEffects.reverb) {
      const reverbProb = (0.85 - (style / 100) * 0.65) * (intensity / 100);
      if (roll(reverbProb)) {
        settings.reverbWet = (intensity / 100) * (0.2 + Math.random() * 0.6);
        names.push(settings.reverbWet > 0.55 ? 'Cathedral Reverb 🏛️' : 'Ambient Space 🌌');
      }
    }

    // 3. Feedback Delay / Echo (highly favored on natural style)
    if (this.enabledRandomEffects.delay) {
      const delayProb = (0.80 - (style / 100) * 0.40) * (intensity / 100);
      if (roll(delayProb)) {
        settings.delayTime = 0.2 + Math.random() * 0.6; // 200ms to 800ms
        settings.delayFeedback = 0.25 + (intensity / 100) * 0.5;
        settings.delayWet = (intensity / 100) * (0.25 + Math.random() * 0.45);
        names.push(settings.delayFeedback > 0.5 ? 'Space Dub Echo 💫' : 'Slapback Delay ⏱️');
      }
    }

    // 4. Tremolo (favored on both styles for pulsing volume modulation)
    if (this.enabledRandomEffects.tremolo) {
      const tremoloProb = (0.3 + (style / 100) * 0.2) * (intensity / 100);
      if (roll(tremoloProb)) {
        settings.tremoloRate = 3.0 + Math.random() * 9.0; // 3Hz to 12Hz
        settings.tremoloDepth = 0.3 + (intensity / 100) * 0.65;
        names.push('Pulse Tremolo 📳');
      }
    }

    // 5. Bitcrusher (only on synthetic style and high intensity)
    if (this.enabledRandomEffects.bitcrusher && intensity > 25 && style > 30) {
      const crushProb = (style / 100) * 0.75 * (intensity / 100);
      if (roll(crushProb)) {
        settings.bitcrusherBits = Math.floor(2 + Math.random() * 4); // 2 to 5 bits (lo-fi goodness)
        settings.bitcrusherWet = 0.35 + (intensity / 100) * 0.55;
        names.push('Lo-Fi Bitcrush 👾');
      }
    }

    // 6. Space Flanger (beautiful dynamic phasing comb sweeps)
    if (this.enabledRandomEffects.flanger) {
      const flangerProb = (0.25 + (style / 100) * 0.4) * (intensity / 100);
      if (roll(flangerProb)) {
        settings.flangerRate = 0.15 + Math.random() * 2.0; // slow sweeps
        settings.flangerDepth = 0.001 + Math.random() * 0.0025;
        settings.flangerWet = 0.3 + (intensity / 100) * 0.6;
        names.push('Space Flanger 🌀');
      }
    }

    // 7. Ring Modulation (only on synthetic style and intensity > 30)
    if (this.enabledRandomEffects.ringmod && intensity > 30 && style > 35) {
      const ringProb = (style / 100) * 0.85 * (intensity / 100);
      if (roll(ringProb)) {
        settings.ringModFreq = 50 + Math.random() * 150; // carrier freq
        settings.ringModWet = 0.3 + (style / 100) * 0.6;
        names.push('Metallic Robot 🤖');
      }
    }

    // 8. Distortion / Overdrive Fuzz (only on synthetic style and intensity > 40)
    if (this.enabledRandomEffects.distortion && intensity > 40 && style > 40) {
      const distProb = (style / 100) * 0.80 * (intensity / 100);
      if (roll(distProb)) {
        settings.distortionAmount = 15 + (style / 100) * (intensity - 40) * 1.5;
        names.push('Crunchy Fuzz 🔥');
      }
    }

    // 9. Filter Sweep (Natural underwater lowpass vs Synthetic vintage highpass radio)
    if (this.enabledRandomEffects.filter) {
      const filterProb = 0.3 + (intensity / 100) * 0.4;
      if (roll(filterProb)) {
        if (style < 50) {
          settings.filterType = 'lowpass';
          settings.filterFrequency = 350 + Math.random() * 450; // Muffled underwater lowpass
          names.push('Underwater Sub 🌊');
        } else {
          settings.filterType = 'highpass';
          settings.filterFrequency = 1200 + Math.random() * 1200; // Tinny radio highpass
          names.push('Vintage Radio 📻');
        }
      }
    }

    // 10. Tape Vibrato / Wow & Flutter
    const vibratoProb = 0.35 * (intensity / 100);
    if (roll(vibratoProb)) {
      settings.vibratoRate = 4.0 + Math.random() * 4.5; // ~4Hz to 8.5Hz speed wobble
      settings.vibratoDepth = 0.001 + Math.random() * 0.0015; // ~1ms to 2.5ms depth
      settings.vibratoWet = 0.35 + (intensity / 100) * 0.55;
      names.push('Tape Flutter 🔮');
    }

    if (names.length === 0) {
      names.push('Clean Audio Only ✨');
    }

    return { settings, names };
  }
}
