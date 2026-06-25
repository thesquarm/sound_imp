import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Square, 
  Volume2, 
  Mic, 
  Sliders, 
  HelpCircle, 
  History, 
  AlertTriangle, 
  Flame, 
  Music,
  Maximize2,
  Upload,
  Download,
  Trash2
} from 'lucide-react';
import { AudioState, ImprovRound } from './types';
import { SoundImproEngine } from './utils/audioEngine';
import { WaveVisualizer } from './components/WaveVisualizer';
import { ImprovHistory } from './components/ImprovHistory';
import { SoundImproHelp } from './components/SoundImproHelp';

export default function App() {
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [intensity, setIntensity] = useState<number>(50);
  const [effectStyle, setEffectStyle] = useState<number>(50); // 0 = Natural, 100 = Synthetic
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  const [recordedCount, setRecordedCount] = useState<number>(0);
  const [rounds, setRounds] = useState<ImprovRound[]>([]);
  const [activeEffects, setActiveEffects] = useState<string[]>([]);
  const [micError, setMicError] = useState<string | null>(null);

  // New Retro Parameter States
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isReversed, setIsReversed] = useState<boolean>(false);
  const [isFilterEnabled, setIsFilterEnabled] = useState<boolean>(true);
  const [onsetThreshold, setOnsetThreshold] = useState<number>(22); // mapped to 0.022
  const [silenceThreshold, setSilenceThreshold] = useState<number>(12); // mapped to 0.012
  const [pauseDurationMs, setPauseDurationMs] = useState<number>(1200);
  const [showInspirationBox, setShowInspirationBox] = useState<boolean>(false);
  const [extraPads, setExtraPads] = useState<any[]>([]);
  const [downloadUrls, setDownloadUrls] = useState<{
    whole: string;
    raw: string;
    processed: string;
  } | null>(null);

  const droneOscsRef = useRef<{ [key: string]: { osc: OscillatorNode; gain: GainNode } }>({});
  
  // Real-time oscilloscope data state
  const [visualData, setVisualData] = useState<{
    dataArray: Uint8Array;
    rms: number;
    isInput: boolean;
  }>({
    dataArray: new Uint8Array(0),
    rms: 0,
    isInput: true,
  });

  const engineRef = useRef<SoundImproEngine | null>(null);

  // Initialize engine
  useEffect(() => {
    const engine = new SoundImproEngine(
      // onStateChange
      (state, metadata) => {
        setAudioState(state);
        if (state === 'playing_answer' && metadata?.effects) {
          setActiveEffects(metadata.effects);
        } else if (state !== 'playing_answer') {
          setActiveEffects([]);
        }
      },
      // onVisualsUpdate
      (dataArray, rms, isInput) => {
        setVisualData({
          dataArray: new Uint8Array(dataArray),
          rms,
          isInput,
        });
      },
      // onRoundComplete
      (round) => {
        setRounds(prev => [round, ...prev]);
        if (engineRef.current) {
          setRecordedCount(engineRef.current.getSessionBuffersCount());
        }
      }
    );

    // Sync initial states
    engine.setIntensity(intensity);
    engine.setEffectStyle(effectStyle);
    engine.setLooping(isLooping);
    engine.setReversed(isReversed);
    engine.setFilterEnabled(isFilterEnabled);
    engine.setOnsetThreshold(onsetThreshold / 1000);
    engine.setSilenceThreshold(silenceThreshold / 1000);
    engine.setPauseDurationMs(pauseDurationMs);

    engineRef.current = engine;

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
      // Stop all active background drones
      Object.values(droneOscsRef.current).forEach((active: any) => {
        try {
          active.osc.stop();
          active.osc.disconnect();
          active.gain.disconnect();
        } catch (e) {}
      });
      droneOscsRef.current = {};
    };
  }, []);

  // Sync state functions
  const handleIntensityChange = (val: number) => {
    setIntensity(val);
    if (engineRef.current) {
      engineRef.current.setIntensity(val);
    }
  };

  const handleEffectStyleChange = (val: number) => {
    setEffectStyle(val);
    if (engineRef.current) {
      engineRef.current.setEffectStyle(val);
    }
  };

  const handleLoopingChange = (val: boolean) => {
    setIsLooping(val);
    if (engineRef.current) {
      engineRef.current.setLooping(val);
    }
  };

  const handleReversedChange = (val: boolean) => {
    setIsReversed(val);
    if (engineRef.current) {
      engineRef.current.setReversed(val);
    }
  };

  const handleFilterEnabledChange = (val: boolean) => {
    setIsFilterEnabled(val);
    if (engineRef.current) {
      engineRef.current.setFilterEnabled(val);
    }
  };

  const handleOnsetChange = (val: number) => {
    setOnsetThreshold(val);
    if (engineRef.current) {
      engineRef.current.setOnsetThreshold(val / 1000);
    }
  };

  const handleSilenceThresholdChange = (val: number) => {
    setSilenceThreshold(val);
    if (engineRef.current) {
      engineRef.current.setSilenceThreshold(val / 1000);
    }
  };

  const handlePauseDurationChange = (val: number) => {
    setPauseDurationMs(val);
    if (engineRef.current) {
      engineRef.current.setPauseDurationMs(val);
    }
  };

  // Add extra ambient pad
  const addExtraPad = () => {
    const padIndex = extraPads.length + 4;
    const colors = [
      { name: 'Warm Terracotta', bg: 'bg-[#d4b2a7]' },
      { name: 'Sunny Peach', bg: 'bg-[#e5c4a5]' },
      { name: 'Vintage Slate Blue', bg: 'bg-[#a3b1bf]' }
    ];
    const color = colors[extraPads.length % colors.length];
    
    // Pick different frequencies for beautiful major/minor chord components
    const freqs = [110, 165, 220, 275, 330, 440];
    const freq = freqs[extraPads.length % freqs.length];
    
    const newPad = {
      id: `pad-${Date.now()}`,
      name: `PAD ${padIndex}`,
      colorClass: color.bg,
      colorName: color.name,
      freq,
      isPlaying: false,
    };
    
    setExtraPads([...extraPads, newPad]);
  };

  // Toggle ambient synthesizer drone
  const toggleDronePad = (padId: string, freq: number) => {
    const ctx = engineRef.current?.getAudioContext();
    if (!ctx) {
      alert("Please press 'Start Session' first to power on the audio engine workbench!");
      return;
    }

    setExtraPads(prev => prev.map(pad => {
      if (pad.id === padId) {
        const isNowPlaying = !pad.isPlaying;
        
        if (isNowPlaying) {
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            
            // Soft background volume
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.2); // sweet fade-in
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(450, ctx.currentTime); // warm filtering
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            droneOscsRef.current[padId] = { osc, gain };
          } catch (e) {
            console.error("Failed to play drone:", e);
          }
        } else {
          const active = droneOscsRef.current[padId];
          if (active) {
            try {
              active.gain.gain.setValueAtTime(active.gain.gain.value, ctx.currentTime);
              active.gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
              setTimeout(() => {
                try {
                  active.osc.stop();
                  active.osc.disconnect();
                  active.gain.disconnect();
                } catch (err) {}
              }, 500);
            } catch (err) {}
            delete droneOscsRef.current[padId];
          }
        }
        
        return { ...pad, isPlaying: isNowPlaying };
      }
      return pad;
    }));
  };

  // Start the improvisation session
  const startSession = async (recordMode: boolean = false) => {
    setMicError(null);
    setIsRecording(recordMode);
    
    if (engineRef.current) {
      try {
        engineRef.current.setRecordingSession(recordMode);
        setRecordedCount(0);
        await engineRef.current.start();
      } catch (err: any) {
        console.error(err);
        setMicError(
          err?.message || 
          "Microphone access denied or unavailable. Please check permission settings in your browser or try opening the app in a new tab."
        );
        setAudioState('idle');
        setIsRecording(false);
      }
    }
  };

  // Stop the session
  const stopSession = () => {
    const wasRecording = isRecording;
    let finalCount = 0;
    let blobs: { whole: Blob | null, raw: Blob | null, processed: Blob | null } = { whole: null, raw: null, processed: null };
    
    if (engineRef.current) {
      finalCount = engineRef.current.getSessionBuffersCount();
      if (wasRecording && finalCount > 0) {
        // Query the engine for the WAV files BEFORE closing the AudioContext!
        blobs.whole = engineRef.current.getWholeSessionWav();
        blobs.raw = engineRef.current.getRawSessionWav();
        blobs.processed = engineRef.current.getProcessedSessionWav();
      }
      engineRef.current.stop();
    }
    
    setVisualData({
      dataArray: new Uint8Array(0),
      rms: 0,
      isInput: true,
    });
    
    setIsRecording(false);
    
    // If we recorded buffers during the session, automatically generate URLs and open export window
    if (wasRecording && finalCount > 0) {
      setRecordedCount(finalCount);
      
      const wholeUrl = blobs.whole ? URL.createObjectURL(blobs.whole) : '';
      const rawUrl = blobs.raw ? URL.createObjectURL(blobs.raw) : '';
      const processedUrl = blobs.processed ? URL.createObjectURL(blobs.processed) : '';
      
      setDownloadUrls({
        whole: wholeUrl,
        raw: rawUrl,
        processed: processedUrl
      });
      setShowDownloadModal(true);
    }
  };

  const closeDownloadModal = () => {
    setShowDownloadModal(false);
    if (downloadUrls) {
      if (downloadUrls.whole) URL.revokeObjectURL(downloadUrls.whole);
      if (downloadUrls.raw) URL.revokeObjectURL(downloadUrls.raw);
      if (downloadUrls.processed) URL.revokeObjectURL(downloadUrls.processed);
      setDownloadUrls(null);
    }
  };

  // Clear session rounds
  const clearRounds = () => {
    setRounds([]);
    if (engineRef.current) {
      engineRef.current.clearSessionBuffers();
      setRecordedCount(0);
    }
  };

  // Get intensity color scheme & labels
  const getIntensityLabel = (val: number) => {
    if (val === 0) return { label: 'Pure & Dry (Original)', color: 'text-studio-muted' };
    if (val < 25) return { label: 'Warm & Subtle Space', color: 'text-emerald-600 font-medium' };
    if (val < 50) return { label: 'Atmospheric Studio', color: 'text-blue-600 font-medium' };
    if (val < 75) return { label: 'Modular Alien Studio', color: 'text-studio-accent font-medium' };
    return { label: 'Absolutely Crazy Chaos! 🌋', color: 'text-rose-600 font-bold animate-pulse' };
  };

  // Get effect style label
  const getEffectStyleLabel = (val: number) => {
    if (val < 20) return '100% Organic (Acoustic spaces)';
    if (val < 45) return 'Warm Analogue (Echoes, filters)';
    if (val < 55) return 'Hybrid Balance (Spaced & Digital)';
    if (val < 80) return 'Synthetic Warp (Chipped speed, Robot)';
    return 'Futuristic Glitch! (Ringmod, Distortion)';
  };

  const intensityInfo = getIntensityLabel(intensity);

  return (
    <div id="sound_impro_app" className="min-h-screen bg-[#FAF6ED] text-zinc-950 font-sans selection:bg-zinc-950/10 flex flex-col antialiased">
      {/* Visual Title / Header following soundcomp look exactly */}
      <header className="py-8 px-4 flex flex-col items-center">
        <h1 className="font-display font-black text-5xl md:text-6xl text-zinc-950 tracking-tight text-center uppercase select-none">
          sound_impro
        </h1>
        
        <p className="text-xs text-zinc-600 font-mono tracking-widest uppercase text-center mt-2.5 font-bold select-none">
          A live conversational sound improviser
        </p>

        {/* Triple decorative bars |·|·| */}
        <div className="flex items-center justify-center gap-1.5 mt-5 select-none">
          <span className="h-4 w-1 bg-zinc-900 rounded-full" />
          <span className="h-1.5 w-1 bg-zinc-900 rounded-full" />
          <span className="h-4 w-1 bg-zinc-900 rounded-full" />
        </div>

        {/* INSPIRATION switch toggle like soundcomp */}
        <div className="flex items-center justify-center gap-2.5 mt-5">
          <span className="text-[10px] font-mono font-black text-zinc-900 uppercase tracking-widest">INSPIRATION</span>
          <button
            onClick={() => setShowInspirationBox(!showInspirationBox)}
            className={`h-5 w-10 border-2 border-zinc-950 rounded-full relative transition-colors cursor-pointer ${
              showInspirationBox ? 'bg-zinc-950' : 'bg-zinc-100'
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full absolute top-1/2 -translate-y-1/2 transition-all ${
                showInspirationBox ? 'right-1 bg-[#FAF6ED]' : 'left-1 bg-zinc-950'
              }`}
            />
          </button>
        </div>

        {/* Dynamic Inspiration suggestions container */}
        {showInspirationBox && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-[#FAF3D1] border-2 border-zinc-950 p-4 mt-5 text-center text-xs font-mono text-zinc-900 shadow-xs retro-shadow-sm rounded-none"
          >
            <span className="font-bold text-zinc-950 block mb-2 uppercase tracking-wide border-b border-zinc-950/20 pb-1.5">
              💡 EXPERIMENTAL TRIGGERS
            </span>
            <div className="grid grid-cols-2 gap-3 text-[10px] text-left text-zinc-800">
              <div className="flex items-start gap-1">
                <span className="text-zinc-500 font-bold">&bull;</span>
                <span>Sing a sustained vowel (Aah, Ooh)</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-zinc-500 font-bold">&bull;</span>
                <span>Make rapid claps or finger snaps</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-zinc-500 font-bold">&bull;</span>
                <span>Whistle a brief 3-note melody</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-zinc-500 font-bold">&bull;</span>
                <span>Tap rhythmically on your tabletop</span>
              </div>
            </div>
          </motion.div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* Error notification if mic fails */}
        {micError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-100 border-2 border-zinc-950 text-red-950 text-xs flex gap-3 items-start retro-shadow-sm rounded-none"
          >
            <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-1">Microphone Access Blocked</span>
              <p className="leading-relaxed">{micError}</p>
              <div className="mt-2.5 flex gap-2">
                <button 
                  onClick={() => startSession(false)} 
                  className="bg-zinc-950 text-white font-mono text-[10px] font-bold px-3.5 py-1.5 border-2 border-zinc-950 transition-all cursor-pointer hover:bg-zinc-800"
                >
                  Try Again
                </button>
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white text-zinc-950 font-mono text-[10px] font-bold px-3.5 py-1.5 border-2 border-zinc-950 transition-all hover:bg-zinc-100"
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          </motion.div>
        )}
            {/* Two-column bento grid following the premium tabletop synthesis gear layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: Improv Core & Controls (7 columns) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Bento Block 1: Improv Engine State Circle */}
            <div className="bg-[#b3b19a] border-2 border-zinc-950 rounded-none p-6 retro-shadow flex flex-col items-center justify-center relative overflow-hidden min-h-[320px] transition-all duration-300">
              
              {/* Soft background decor based on state */}
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[80px] transition-all duration-1000 ${
                  audioState === 'waiting_for_sound' ? 'bg-zinc-500/20' :
                  audioState === 'recording_sound' ? 'bg-rose-500/35' :
                  audioState === 'playing_answer' ? 'bg-[#b0a2be]/45' : 'bg-transparent'
                }`} />
              </div>

              <AnimatePresence mode="wait">
                {audioState === 'idle' ? (
                  // IDLE VIEW: Start Session Trigger
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col items-center text-center gap-5 z-10"
                  >
                    <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center text-zinc-950 border-2 border-dashed border-zinc-950 animate-bounce">
                      <Mic className="h-8 w-8 text-zinc-950" />
                    </div>
                    <div>
                      <h2 className="font-display font-black text-xl uppercase tracking-tight text-zinc-950">Improvise with Machine Synthesis</h2>
                      <p className="text-xs text-zinc-900 font-mono max-w-[360px] mt-1.5 leading-relaxed font-bold">
                        Say a word, sing a tone, whistle or clap! The engine auto-detects sound pauses, processes your inputs with custom modular effects, and plays back its creative response.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-1">
                      <button
                        onClick={() => startSession(false)}
                        className="bg-[#FAF6ED] hover:bg-[#FAF3D1] text-zinc-950 border-2 border-zinc-950 px-6 py-3 font-mono font-bold tracking-tight shadow-md retro-shadow-sm transition-all flex items-center justify-center gap-2 text-xs cursor-pointer rounded-none uppercase"
                      >
                        <Play className="h-4 w-4 fill-current text-zinc-950" />
                        Start Session Only
                      </button>
                      <button
                        onClick={() => startSession(true)}
                        className="bg-rose-600 hover:bg-rose-700 text-white border-2 border-zinc-950 px-6 py-3 font-mono font-bold tracking-tight shadow-md retro-shadow-sm transition-all flex items-center justify-center gap-2 text-xs cursor-pointer rounded-none uppercase"
                      >
                        <span className="h-2.5 w-2.5 rounded-full bg-white shrink-0 animate-pulse" />
                        Start & Record Session
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  // ACTIVE RUNNING VIEW: Displays current state cues
                  <motion.div 
                    key="active"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full flex flex-col items-center gap-6 z-10"
                  >
                    {/* The Giant Audio Pulse Ring */}
                    <div className="relative flex items-center justify-center h-40 w-40">
                      
                      {/* State outer ripple circle */}
                      <div className={`absolute inset-0 rounded-full transition-all duration-700 border-2 ${
                        audioState === 'waiting_for_sound' ? 'border-dashed border-zinc-900 scale-100' :
                        audioState === 'recording_sound' ? 'border-rose-600 animate-pulse' :
                        audioState === 'playing_answer' ? 'border-zinc-950 animate-pulse' : 'border-zinc-500 scale-90'
                      }`} />

                      <div className={`absolute inset-3 rounded-full transition-all duration-700 border ${
                        audioState === 'waiting_for_sound' ? 'border-dashed border-zinc-800' :
                        audioState === 'recording_sound' ? 'border-rose-600/30 bg-rose-50/10 scale-105' :
                        audioState === 'playing_answer' ? 'border-zinc-950/30 bg-zinc-950/10 scale-105' : 'border-zinc-600'
                      }`} />

                      {/* State Central Node Core */}
                      <div className={`h-26 w-26 rounded-full flex flex-col items-center justify-center text-[#FAF6ED] transition-all duration-500 shadow-md border-2 border-zinc-950 ${
                        audioState === 'initializing' ? 'bg-zinc-400' :
                        audioState === 'waiting_for_sound' ? 'bg-zinc-950' :
                        audioState === 'recording_sound' ? 'bg-rose-600 scale-105' :
                        audioState === 'processing' ? 'bg-amber-500 animate-pulse' :
                        audioState === 'playing_answer' ? 'bg-zinc-950 scale-105' : 'bg-zinc-50'
                      }`}>
                        {audioState === 'initializing' && <span className="text-[10px] font-mono tracking-widest font-black uppercase">BOOTING</span>}
                        
                        {audioState === 'waiting_for_sound' && (
                          <div className="flex flex-col items-center gap-1.5 animate-pulse">
                            <Mic className="h-6 w-6 text-white" />
                            <span className="text-[8px] font-mono tracking-widest uppercase">SPEAK NOW</span>
                          </div>
                        )}

                        {audioState === 'recording_sound' && (
                          <div className="flex flex-col items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-white animate-ping" />
                            <span className="text-[9px] font-mono tracking-widest font-black">RECORDING</span>
                            <span className="text-[8px] font-mono opacity-90">
                              {visualData.rms > 0 ? (visualData.rms * 100).toFixed(0) : '0'}% VOL
                            </span>
                          </div>
                        )}

                        {audioState === 'processing' && (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" />
                            </div>
                            <span className="text-[9px] font-mono tracking-widest">SYNTHESIZING</span>
                          </div>
                        )}

                        {audioState === 'playing_answer' && (
                          <div className="flex flex-col items-center gap-1.5">
                            <Volume2 className="h-6 w-6 animate-pulse text-white" />
                            <span className="text-[8px] font-mono tracking-widest uppercase text-white">REPLYING</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Interactive Text Prompt */}
                    <div className="text-center px-4">
                      <h3 className="font-display font-black text-2.5xl text-zinc-950 tracking-tight uppercase transition-colors duration-300">
                        {audioState === 'initializing' && 'ARMING WORKBENCH...'}
                        {audioState === 'waiting_for_sound' && 'Make a sound.'}
                        {audioState === 'recording_sound' && 'Sound active... Recording...'}
                        {audioState === 'processing' && 'Synthesizing creative answer...'}
                        {audioState === 'playing_answer' && 'Responding...'}
                      </h3>
                      
                      <p className="text-xs text-zinc-900 font-mono mt-1 max-w-[340px] mx-auto leading-relaxed h-5 font-bold">
                        {audioState === 'waiting_for_sound' && 'Speak, whistle, sing or tap!'}
                        {audioState === 'recording_sound' && 'Stop making sound to trigger playback.'}
                        {audioState === 'processing' && 'Rendering audio effects graph offline...'}
                        {audioState === 'playing_answer' && 'Listen to the modified replication.'}
                      </p>
                    </div>

                    {/* Active effects overlay during playback */}
                    {audioState === 'playing_answer' && activeEffects.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap gap-1.5 justify-center max-w-[380px] mt-1 animate-fade-in"
                      >
                        {activeEffects.map((eff, i) => (
                          <span 
                            key={i} 
                            className="text-[10px] font-mono font-black bg-zinc-950 text-[#FAF6ED] px-2.5 py-1 border border-zinc-950 shadow-xs uppercase"
                          >
                            {eff}
                          </span>
                        ))}
                      </motion.div>
                    )}

                    {/* Recording metadata tag */}
                    {isRecording && (
                      <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3 py-1 border border-rose-900/30 text-[10px] font-mono font-bold uppercase tracking-wider mt-1">
                        <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                        REC ACTIVE &bull; {recordedCount} ROUND{recordedCount !== 1 ? 'S' : ''} SAVED
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bento Block 2: Synthesis Controls & Sliders */}
            <div className="bg-[#b0a2be] border-2 border-zinc-950 rounded-none p-5 shadow-xs flex flex-col gap-5 retro-shadow">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-950/20 pb-3 font-mono text-zinc-950">
                <span className="font-display font-black text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-zinc-950" />
                  Synthesis Controls
                </span>
                {audioState !== 'idle' && (
                  <span className="text-[10px] font-mono text-[#FAF6ED] bg-zinc-950 border border-zinc-950 px-2 py-0.5 font-bold">
                    SIGNAL LOOP LOCKED
                  </span>
                )}
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Slider 1: Effect Level / Wildness */}
                <div className="flex flex-col gap-2 p-4 bg-white border-2 border-zinc-950 rounded-none">
                  <div className="flex items-center justify-between text-xs font-mono font-black text-zinc-950">
                    <span>WILDNESS (SPEED)</span>
                    <span className="font-bold">{intensity}%</span>
                  </div>
                  
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={intensity}
                    onChange={(e) => handleIntensityChange(parseInt(e.target.value))}
                    className="w-full h-1 bg-zinc-950/20 rounded-none appearance-none cursor-pointer py-1.5"
                    style={{ accentColor: '#000000' }}
                  />

                  <div className="flex justify-between text-[9px] font-mono text-zinc-600 mt-1 uppercase font-bold">
                    <span>Clean</span>
                    <span>Moderate</span>
                    <span className="flex items-center gap-0.5 text-rose-600">
                      <Flame className="h-3 w-3 shrink-0" />
                      Crazy!
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-zinc-700 text-center border-t border-zinc-950/15 pt-2 mt-2 leading-tight uppercase font-black">
                    Mode: <span className="text-zinc-950">{intensityInfo.label}</span>
                  </div>
                </div>

                {/* Slider 2: Effect Style (Natural vs Synthetic) */}
                <div className="flex flex-col gap-2 p-4 bg-white border-2 border-zinc-950 rounded-none">
                  <div className="flex items-center justify-between text-xs font-mono font-black text-zinc-950">
                    <span>CHARACTER (STYLE)</span>
                    <span className="font-bold">{effectStyle}%</span>
                  </div>
                  
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={effectStyle}
                    onChange={(e) => handleEffectStyleChange(parseInt(e.target.value))}
                    className="w-full h-1 bg-zinc-950/20 rounded-none appearance-none cursor-pointer py-1.5"
                    style={{ accentColor: '#000000' }}
                  />

                  <div className="flex justify-between text-[9px] font-mono text-zinc-600 mt-1 uppercase font-bold">
                    <span>Natural</span>
                    <span>Hybrid</span>
                    <span>Synthetic</span>
                  </div>

                  <div className="text-[10px] font-mono text-zinc-700 text-center border-t border-zinc-950/15 pt-2 mt-2 leading-tight uppercase font-black">
                    Type: <span className="text-zinc-950">{getEffectStyleLabel(effectStyle)}</span>
                  </div>
                </div>

              </div>

              {/* Extras Parameter panel for custom features in layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Onset gate & timeout */}
                <div className="flex flex-col gap-3 p-4 bg-white border-2 border-zinc-950 rounded-none font-mono text-xs font-black text-zinc-950">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>ONSET THRESHOLD</span>
                      <span>{(onsetThreshold / 1000).toFixed(3)} V</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="150"
                      value={onsetThreshold}
                      onChange={(e) => handleOnsetChange(parseInt(e.target.value))}
                      className="w-full h-1 bg-zinc-950/20 appearance-none cursor-pointer py-1.5"
                      style={{ accentColor: '#000000' }}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>PAUSE TIMEOUT</span>
                      <span>{pauseDurationMs}ms</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="2500"
                      step="100"
                      value={pauseDurationMs}
                      onChange={(e) => handlePauseDurationChange(parseInt(e.target.value))}
                      className="w-full h-1 bg-zinc-950/20 appearance-none cursor-pointer py-1.5"
                      style={{ accentColor: '#000000' }}
                    />
                  </div>
                </div>

                {/* Upload & Loop modifiers */}
                <div className="flex flex-col justify-between p-4 bg-white border-2 border-zinc-950 rounded-none">
                  {/* File Upload button */}
                  <label className="flex items-center justify-center gap-2 py-2.5 px-3 border-2 border-zinc-950 bg-[#FAF6ED] hover:bg-zinc-100 transition-all font-mono text-[10px] font-black uppercase text-zinc-950 cursor-pointer select-none">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload voice / audio file</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          if (audioState === 'idle') {
                            await startSession(false);
                          }
                          if (engineRef.current) {
                            await engineRef.current.processCustomAudioFile(file);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                    />
                  </label>

                  {/* Micro switches */}
                  <div className="flex items-center justify-between font-mono text-[10px] font-black uppercase text-zinc-950 mt-3 border-t border-zinc-950/10 pt-2.5 select-none">
                    <button 
                      onClick={() => handleLoopingChange(!isLooping)}
                      className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                    >
                      <span>LOOP</span>
                      <span className={`h-2.5 w-2.5 rounded-full border border-zinc-950 ${isLooping ? 'bg-zinc-950' : 'bg-transparent'}`} />
                    </button>

                    <button 
                      onClick={() => handleReversedChange(!isReversed)}
                      className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                    >
                      <span>REVERSE</span>
                      <span className={`h-2.5 w-2.5 rounded-full border border-zinc-950 ${isReversed ? 'bg-zinc-950' : 'bg-transparent'}`} />
                    </button>

                    <button 
                      onClick={() => handleFilterEnabledChange(!isFilterEnabled)}
                      className="flex items-center gap-1 cursor-pointer hover:opacity-80"
                    >
                      <span>FILTER</span>
                      <span className={`h-2.5 w-2.5 rounded-full border border-zinc-950 ${isFilterEnabled ? 'bg-zinc-950' : 'bg-transparent'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Oscilloscope Real-time viz */}
              <div className="flex flex-col gap-2 border-t border-zinc-950/15 pt-4">
                <span className="text-[10px] font-mono font-black text-zinc-950/70 uppercase tracking-wider">
                  Real-time Signal Monitor (Oscilloscope)
                </span>
                <div className="bg-zinc-950 border-2 border-zinc-950 h-28 relative flex items-center justify-center shadow-xs overflow-hidden rounded-none">
                  <div className="absolute left-2 top-2 bottom-2 w-1 bg-white/20 border-l border-r border-white/30" />
                  <div className="absolute right-2 top-2 bottom-2 w-1 bg-white/20 border-l border-r border-white/30" />
                  <WaveVisualizer
                    dataArray={visualData.dataArray}
                    rms={visualData.rms}
                    isInput={visualData.isInput}
                    isActive={audioState !== 'idle'}
                    state={audioState}
                  />
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: History & Documentation / User Manual (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Session Action Control Capsule bar located elegantly above the history */}
            <div className="bg-white border-2 border-zinc-950 p-4 retro-shadow rounded-none flex flex-col gap-3">
              <span className="text-[10px] font-mono font-black uppercase text-zinc-500 tracking-wider">
                Session Control Desk
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => startSession(false)}
                    disabled={audioState !== 'idle'}
                    className={`flex-1 font-mono text-[11px] font-black py-3.5 border-2 border-zinc-950 flex items-center justify-center gap-1.5 rounded-none uppercase transition-all ${
                      audioState === 'idle'
                        ? 'bg-zinc-950 text-[#FAF6ED] hover:bg-zinc-850 cursor-pointer retro-shadow-xs'
                        : 'bg-zinc-100 text-zinc-400 border-zinc-300 pointer-events-none'
                    }`}
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>Start Session</span>
                  </button>

                  <button
                    onClick={() => startSession(true)}
                    disabled={audioState !== 'idle'}
                    className={`flex-1 font-mono text-[11px] font-black py-3.5 border-2 border-zinc-950 flex items-center justify-center gap-1.5 rounded-none uppercase transition-all ${
                      audioState === 'idle'
                        ? 'bg-rose-600 text-[#FAF6ED] hover:bg-rose-700 cursor-pointer retro-shadow-xs'
                        : 'bg-zinc-100 text-zinc-400 border-zinc-300 pointer-events-none'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    <span>Record Session</span>
                  </button>
                </div>

                <button
                  onClick={stopSession}
                  disabled={audioState === 'idle'}
                  className={`w-full font-mono text-[11px] font-black py-3.5 border-2 border-zinc-950 flex items-center justify-center gap-1.5 rounded-none uppercase transition-all ${
                    audioState !== 'idle'
                      ? 'bg-zinc-950 text-[#FAF6ED] hover:bg-zinc-850 cursor-pointer retro-shadow-xs'
                      : 'bg-zinc-100 text-zinc-300 border-zinc-200 pointer-events-none'
                  }`}
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop & Export Session</span>
                </button>
              </div>
            </div>

            {/* Deck 1: Historic tape reel rolls (History list - Sage Green background matching Pad 3) */}
            <div className="bg-[#8da99d] border-2 border-zinc-950 p-5 retro-shadow rounded-none">
              <ImprovHistory rounds={rounds} onClear={clearRounds} />
            </div>

            {/* Deck 2: System User Manual */}
            <SoundImproHelp />

          </div>

        </div>

        {/* Ambient Synthesizer Drone Deck at the bottom */}
        <div className="border-2 border-zinc-950 p-5 bg-white retro-shadow mt-2 flex flex-col gap-4 rounded-none">
          <div className="flex items-center justify-between border-b border-zinc-950/15 pb-2">
            <div>
              <span className="font-display font-black text-sm tracking-widest text-zinc-950 uppercase block">
                Ambient Drones Base
              </span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase">
                Procedural low-frequency triangle waves to layer beautiful background chords
              </span>
            </div>
            <button
              onClick={addExtraPad}
              className="bg-zinc-950 hover:bg-zinc-850 text-[#FAF6ED] border-2 border-zinc-950 font-mono font-black text-[10px] px-4 py-2 rounded-none transition-all cursor-pointer uppercase flex items-center gap-1"
            >
              <span>+ Add Ambient Tone</span>
            </button>
          </div>

          {/* Spawned extra pads for ambient synthesizer drones */}
          {extraPads.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1">
              {extraPads.map((pad) => (
                <motion.div
                  key={pad.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`${pad.colorClass} border-2 border-zinc-950 p-4 retro-shadow-xs flex flex-col gap-3 relative rounded-none`}
                >
                  <div className="flex items-center justify-between border-b border-zinc-950/15 pb-2">
                    <span className="font-display font-black text-xs tracking-widest text-zinc-950 uppercase">{pad.name}</span>
                    <button
                      onClick={() => toggleDronePad(pad.id, pad.freq)}
                      className="h-7 w-7 rounded-full bg-zinc-950 flex items-center justify-center text-white border-2 border-zinc-950 hover:bg-zinc-800 transition-all cursor-pointer shadow-xs"
                    >
                      {pad.isPlaying ? (
                        <Square className="h-2.5 w-2.5 fill-current text-rose-500 animate-pulse" />
                      ) : (
                        <Play className="h-2.5 w-2.5 fill-current text-white" />
                      )}
                    </button>
                  </div>

                  <div className="bg-white/50 border border-zinc-950/20 p-2 text-center rounded-none">
                    <span className="text-[9px] font-mono font-black text-zinc-950 block">DRONE TONE</span>
                    <span className="text-base font-display font-black text-zinc-950 block mt-0.5">{pad.freq} Hz</span>
                    <span className="text-[8px] font-mono text-zinc-600 block mt-0.5">{pad.colorName}</span>
                  </div>

                  <div className="text-[9px] font-mono font-black text-zinc-950 text-center uppercase tracking-wider">
                    {pad.isPlaying ? "🔊 Stream Active" : "🔇 Powered Off"}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-zinc-950/10 bg-zinc-50/50">
              <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                No ambient drone generators active. Click "+ Add Ambient Tone" to spin up background retro oscillators.
              </span>
            </div>
          )}
        </div>

      </main>

      {/* Export Window Modal Overlay with working direct anchors */}
      <AnimatePresence>
        {showDownloadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={closeDownloadModal}
              className="absolute inset-0 bg-zinc-950"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#FAF6ED] border-4 border-zinc-950 p-6 max-w-md w-full retro-shadow-lg text-center relative z-10 rounded-none flex flex-col gap-5"
            >
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-zinc-950 border-2 border-zinc-950 mx-auto text-white shadow-xs">
                <Music className="h-7 w-7 text-[#FAF6ED]" />
              </div>

              <div>
                <h2 className="font-display font-black text-2xl uppercase tracking-tight text-zinc-950">
                  EXPORT SESSION AUDIO
                </h2>
                <div className="h-1 w-20 bg-zinc-950 mx-auto mt-2" />
                <p className="text-xs text-zinc-700 font-mono mt-3 leading-relaxed">
                  You have successfully captured <span className="font-bold text-zinc-950 underline">{recordedCount}</span> rounds of back-and-forth improvisation! Click the WAV buttons to download:
                </p>
              </div>

              {/* Direct clickable anchor buttons */}
              <div className="flex flex-col gap-3 mt-1">
                
                {/* 1. Whole session */}
                <a
                  href={downloadUrls?.whole || '#'}
                  download={`sound_impro_session_full_${Date.now()}.wav`}
                  className={`bg-zinc-950 hover:bg-zinc-900 text-white border-2 border-zinc-950 py-3 px-4 font-mono text-xs font-bold retro-shadow-sm flex items-center justify-between transition-all group ${
                    !downloadUrls?.whole ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }`}
                >
                  <span className="text-left">
                    <span className="block font-black text-[13px] uppercase tracking-tight">1. FULL CONTINUOUS SESSION</span>
                    <span className="block text-[10px] text-zinc-400 font-normal">Alternating User sounds & Effects</span>
                  </span>
                  <span className="bg-white text-zinc-950 text-[10px] px-2.5 py-1 border border-zinc-950 font-bold uppercase shrink-0">WAV</span>
                </a>

                {/* 2. Raw sounds */}
                <a
                  href={downloadUrls?.raw || '#'}
                  download={`sound_impro_my_raw_sounds_${Date.now()}.wav`}
                  className={`bg-white hover:bg-zinc-50 text-zinc-950 border-2 border-zinc-950 py-3 px-4 font-mono text-xs font-bold retro-shadow-sm flex items-center justify-between transition-all group ${
                    !downloadUrls?.raw ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }`}
                >
                  <span className="text-left">
                    <span className="block font-black text-[13px] uppercase tracking-tight">2. YOUR MIC RECORDINGS ONLY</span>
                    <span className="block text-[10px] text-zinc-500 font-normal">Pure un-processed user audio</span>
                  </span>
                  <span className="bg-zinc-950 text-white text-[10px] px-2.5 py-1 border border-zinc-950 font-bold uppercase shrink-0">WAV</span>
                </a>

                {/* 3. Processed sounds */}
                <a
                  href={downloadUrls?.processed || '#'}
                  download={`sound_impro_processed_answers_${Date.now()}.wav`}
                  className={`bg-white hover:bg-zinc-50 text-zinc-950 border-2 border-zinc-950 py-3 px-4 font-mono text-xs font-bold retro-shadow-sm flex items-center justify-between transition-all group ${
                    !downloadUrls?.processed ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }`}
                >
                  <span className="text-left">
                    <span className="block font-black text-[13px] uppercase tracking-tight">3. COMPUTER REPLIES ONLY</span>
                    <span className="block text-[10px] text-zinc-500 font-normal">Concatenated machine outputs</span>
                  </span>
                  <span className="bg-zinc-950 text-white text-[10px] px-2.5 py-1 border border-zinc-950 font-bold uppercase shrink-0">WAV</span>
                </a>

              </div>

              {/* Dismiss Button */}
              <button
                onClick={closeDownloadModal}
                className="mt-2 text-xs font-mono font-bold text-zinc-600 hover:text-zinc-950 underline cursor-pointer"
              >
                Close and Keep Improvising &rarr;
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clean, minimalist footer containing the relocated soundcomp link */}
      <footer className="py-8 px-4 text-center text-xs font-mono text-zinc-600 mt-auto select-none">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 border-t-2 border-zinc-950/15 pt-6">
          <div className="text-center md:text-left">
            <span className="font-bold text-zinc-950 block">sound_impro &bull; Conversational Sound Lab</span>
            <span className="text-[10px] text-zinc-500">Continuous sound synthesis & back-and-forth responsive improvisation.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-bold">
            <a 
              href="https://soundcomp.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-zinc-950 text-white hover:bg-zinc-800 border-2 border-zinc-950 px-4 py-2 retro-shadow-sm transition-all"
            >
              <span>Explore soundcomp</span>
              <Maximize2 className="h-3.5 w-3.5" />
            </a>
            <span className="text-zinc-400 font-normal hidden sm:inline">|</span>
            <span className="font-normal text-[10px] text-zinc-500 bg-zinc-100 px-2.5 py-1 border border-zinc-200">
              Web Audio 16-bit WAV PCM Encoder
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
