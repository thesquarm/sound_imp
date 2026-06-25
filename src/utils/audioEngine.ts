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
  
  // Real-time tracking
  private isAnalyzing = false;
  private silenceStartTime: number | null = null;
  private recordingStartTime: number | null = null;
  private activeSourceNode: AudioBufferSourceNode | null = null;
  private lastUserBlobUrl: string | null = null;

  constructor(
    onStateChange: (state: AudioState, metadata?: any) => void,
    onVisualsUpdate: (dataArray: Uint8Array, rms: number, isInput: boolean) => void,
    onRoundComplete: (round: ImprovRound) => void
  ) {
    this.onStateChange = onStateChange;
    this.onVisualsUpdate = onVisualsUpdate;
    this.onRoundComplete = onRoundComplete;
  }

  public setIntensity(val: number) {
    this.intensity = val;
  }

  public getIntensity(): number {
    return this.intensity;
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

  public setLooping(val: boolean) {
    this.isLooping = val;
    if (this.activeSourceNode) {
      this.activeSourceNode.loop = val;
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

  public clearSessionBuffers() {
    this.sessionBuffers = [];
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
    if (this.lastUserBlobUrl) {
      URL.revokeObjectURL(this.lastUserBlobUrl);
      this.lastUserBlobUrl = null;
    }

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

    // Sound Onset & Silence detection state machine
    if (this.currentState === 'waiting_for_sound') {
      if (rms > this.onsetThreshold) {
        // Sound has started! Trigger recording
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
      // Create local URL of the user's recorded audio for downloading/saving
      if (this.lastUserBlobUrl) {
        URL.revokeObjectURL(this.lastUserBlobUrl);
      }
      this.lastUserBlobUrl = URL.createObjectURL(blob);

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

      // Procedurally select effects based on intensity & style
      const { settings, names } = this.generateRandomEffects(this.intensity, this.effectStyle);

      // Render the processed buffer offline (extremely fast and CPU-safe!)
      const processedBuffer = await this.renderProcessedBuffer(rawBuffer, settings);

      // Save buffers if session recording is active
      if (this.isRecordingSession) {
        this.sessionBuffers.push({ userBuffer: rawBuffer, processedBuffer });
      }

      // Trigger pre-rendered direct playback (ensures perfect fidelity!)
      this.playProcessedBufferDirect(processedBuffer, rawBuffer.duration, settings, names);

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
    
    const offlineCtx = new OfflineAudioContext(
      userBuffer.numberOfChannels,
      targetLength,
      ctx.sampleRate
    );

    // 1. Create Source Node
    const source = offlineCtx.createBufferSource();
    source.buffer = userBuffer;
    source.playbackRate.value = settings.pitchRate;

    // 2. Setup Nodes for each effect
    const finalChain: AudioNode[] = [];

    // [EFFECT] Vibrato LFO Delay (modulates pitch dynamically over time)
    if (settings.vibratoDepth > 0) {
      const vibratoDelay = offlineCtx.createDelay();
      vibratoDelay.delayTime.value = 0.012; // 12ms base delay
      
      const vibratoLfo = offlineCtx.createOscillator();
      vibratoLfo.frequency.value = settings.vibratoRate;
      
      const vibratoLfoGain = offlineCtx.createGain();
      vibratoLfoGain.gain.value = settings.vibratoDepth;

      vibratoLfo.connect(vibratoLfoGain);
      vibratoLfoGain.connect(vibratoDelay.delayTime);
      vibratoLfo.start();
      finalChain.push(vibratoDelay);
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

    // 5. Start source and render
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered;
  }

  /**
   * Plays back the pre-rendered processed AudioBuffer directly through the visualizer & audio output
   */
  private playProcessedBufferDirect(
    processedBuffer: AudioBuffer,
    originalDurationSec: number,
    settings: EffectSettings,
    effectNames: string[]
  ) {
    const ctx = this.audioContext;
    if (!ctx) return;

    this.changeState('playing_answer', { effects: effectNames });

    // 1. Create Playback Buffer (Clone and reverse if requested)
    let playbackBuffer = processedBuffer;
    if (this.isReversed) {
      const channels = processedBuffer.numberOfChannels;
      const length = processedBuffer.length;
      const sampleRate = processedBuffer.sampleRate;
      const reversedBuffer = ctx.createBuffer(channels, length, sampleRate);
      for (let c = 0; c < channels; c++) {
        const srcData = processedBuffer.getChannelData(c);
        const destData = reversedBuffer.getChannelData(c);
        destData.set(srcData);
        Array.prototype.reverse.call(destData);
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
    masterGain.gain.value = 0.95; // clean headroom

    source.connect(this.playbackAnalyser!);
    this.playbackAnalyser!.connect(masterGain);
    masterGain.connect(ctx.destination);

    // 3. Playback Completion Handler
    source.onended = () => {
      // Record round completion stats
      const round: ImprovRound = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        durationSec: parseFloat((originalDurationSec / settings.pitchRate).toFixed(1)),
        effectsApplied: effectNames.length > 0 ? effectNames : ['Clean Audio Only'],
        intensity: this.intensity,
        userAudioUrl: this.lastUserBlobUrl || undefined
      };
      
      this.lastStates = [round, ...this.lastStates].slice(0, 10);
      this.onRoundComplete(round);

      // Automatically transition back to recording mode (Continuous improvisation!)
      if (this.currentState === 'playing_answer') {
        this.changeState('waiting_for_sound');
      }
    };

    // Start playback
    source.start(0);
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

  /**
   * Generates a pristine alternating mix of the full session
   */
  public getWholeSessionWav(): Blob | null {
    const concatenated = this.concatenateSessionAlternating();
    return concatenated ? this.bufferToWav(concatenated) : null;
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
      vibratoRate: 6.0,
      vibratoDepth: 0,
      ringModFreq: 80,
      ringModWet: 0
    };

    const names: string[] = [];

    if (intensity === 0) {
      return { settings, names: ['Clean Feed ✨'] };
    }

    const roll = (prob: number) => Math.random() < prob;

    // 1. Pitch Shift / Speed effect (highly favored on synthetic style)
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

    // 2. Lush Reverb (highly favored on natural style)
    const reverbProb = (0.85 - (style / 100) * 0.65) * (intensity / 100);
    if (roll(reverbProb)) {
      settings.reverbWet = (intensity / 100) * (0.2 + Math.random() * 0.6);
      names.push(settings.reverbWet > 0.55 ? 'Cathedral Reverb 🏛️' : 'Ambient Space 🌌');
    }

    // 3. Feedback Delay / Echo (highly favored on natural style)
    const delayProb = (0.80 - (style / 100) * 0.40) * (intensity / 100);
    if (roll(delayProb)) {
      settings.delayTime = 0.2 + Math.random() * 0.6; // 200ms to 800ms
      settings.delayFeedback = 0.25 + (intensity / 100) * 0.5;
      settings.delayWet = (intensity / 100) * (0.25 + Math.random() * 0.45);
      names.push(settings.delayFeedback > 0.5 ? 'Space Dub Echo 💫' : 'Slapback Delay ⏱️');
    }

    // 4. Vibrato (favored on synthetic style)
    const vibratoProb = (0.15 + (style / 100) * 0.70) * (intensity / 100);
    if (roll(vibratoProb)) {
      settings.vibratoRate = 4.5 + Math.random() * 5.0; // 4.5Hz to 9.5Hz
      settings.vibratoDepth = (intensity / 100) * (style / 100) * 0.006;
      names.push(settings.vibratoDepth > 0.0035 ? 'Psychedelic Warble 🌀' : 'Mild Vibrato 📳');
    }

    // 5. Ring Modulation (only on synthetic style and intensity > 30)
    if (intensity > 30 && style > 35) {
      const ringProb = (style / 100) * 0.85 * (intensity / 100);
      if (roll(ringProb)) {
        settings.ringModFreq = 50 + Math.random() * 150; // carrier freq
        settings.ringModWet = 0.3 + (style / 100) * 0.6;
        names.push('Metallic Robot 🤖');
      }
    }

    // 6. Distortion / Overdrive Fuzz (only on synthetic style and intensity > 40)
    if (intensity > 40 && style > 40) {
      const distProb = (style / 100) * 0.80 * (intensity / 100);
      if (roll(distProb)) {
        settings.distortionAmount = 15 + (style / 100) * (intensity - 40) * 1.5;
        names.push('Crunchy Fuzz 🔥');
      }
    }

    // 7. Filter Sweep (Natural underwater lowpass vs Synthetic vintage highpass radio)
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

    if (names.length === 0) {
      names.push('Mild Echo ⏱️');
      settings.delayWet = 0.2;
      settings.delayTime = 0.3;
    }

    return { settings, names };
  }
}
