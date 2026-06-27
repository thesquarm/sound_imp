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
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AudioState, ImprovRound } from './types';
import { SoundImproEngine } from './utils/audioEngine';
import { WaveVisualizer } from './components/WaveVisualizer';
import { ImprovHistory } from './components/ImprovHistory';
import { SoundImproHelp } from './components/SoundImproHelp';

const DRONE_SCALES = [
  {
    id: 'zen',
    name: 'Zen Garden 🌸',
    desc: 'Pentatonic Major - Peaceful, harmonic, meditative.',
    notes: [
      { freq: 110.0, name: 'Root A2' },
      { freq: 138.6, name: 'Major Third C#3' },
      { freq: 164.8, name: 'Perfect Fifth E3' },
      { freq: 185.0, name: 'Major Sixth F#3' },
      { freq: 220.0, name: 'Octave A3' }
    ],
    colors: ['bg-[#8da99d]', 'bg-[#b6c7b9]', 'bg-[#988bb5]', 'bg-[#8a9ca8]', 'bg-[#c2aa72]']
  },
  {
    id: 'cold_mist',
    name: 'Cold Mist ❄️',
    desc: 'Natural Minor - Melancholic, cinematic, cold.',
    notes: [
      { freq: 110.0, name: 'Root A2' },
      { freq: 130.8, name: 'Minor Third C3' },
      { freq: 146.8, name: 'Perfect Fourth D3' },
      { freq: 164.8, name: 'Perfect Fifth E3' },
      { freq: 174.6, name: 'Minor Sixth F3' }
    ],
    colors: ['bg-[#8a9ca8]', 'bg-[#9ab4c5]', 'bg-[#969e7f]', 'bg-[#FAF3D1]', 'bg-[#cfa588]']
  },
  {
    id: 'crimson',
    name: 'Suspense Crimson 🩸',
    desc: 'Phrygian Mode - High drama, dark, exotic tension.',
    notes: [
      { freq: 110.0, name: 'Root A2' },
      { freq: 116.5, name: 'Flat Second Bb2' },
      { freq: 138.6, name: 'Major Third C#3' },
      { freq: 164.8, name: 'Perfect Fifth E3' },
      { freq: 196.0, name: 'Minor Seventh G3' }
    ],
    colors: ['bg-[#b85a5a]', 'bg-[#d67b7b]', 'bg-[#ba9e68]', 'bg-[#988bb5]', 'bg-[#969e7f]']
  },
  {
    id: 'subterranean',
    name: 'Subterranean 🕳️',
    desc: 'Tritone Tension - Heavy tension, dissonant, eerie.',
    notes: [
      { freq: 98.0, name: 'Root G2' },
      { freq: 138.6, name: 'Dissonant Tritone C#3' },
      { freq: 146.8, name: 'Perfect Fifth D3' },
      { freq: 207.7, name: 'Tension Octave G#3' },
      { freq: 220.0, name: 'Tension Ninth A3' }
    ],
    colors: ['bg-[#4a5568]', 'bg-[#718096]', 'bg-[#e2e8f0]', 'bg-[#cbd5e1]', 'bg-[#94a3b8]']
  },
  {
    id: 'celestial',
    name: 'Celestial Dream 🌌',
    desc: 'Lydian Mode - Bright, mystical, floating spacerock.',
    notes: [
      { freq: 87.3, name: 'Root F2' },
      { freq: 98.0, name: 'Major Second G2' },
      { freq: 110.0, name: 'Major Third A2' },
      { freq: 123.5, name: 'Sharp Fourth B2' },
      { freq: 130.8, name: 'Perfect Fifth C3' }
    ],
    colors: ['bg-[#3b82f6]', 'bg-[#60a5fa]', 'bg-[#93c5fd]', 'bg-[#bfdbfe]', 'bg-[#dbeafe]']
  },
  {
    id: 'ancient',
    name: 'Ancient Ruins 🏛️',
    desc: 'Dorian Mode - Soulful, historic vintage analogue.',
    notes: [
      { freq: 73.4, name: 'Root D2' },
      { freq: 87.3, name: 'Minor Third F2' },
      { freq: 98.0, name: 'Perfect Fourth G2' },
      { freq: 123.5, name: 'Major Sixth B2' },
      { freq: 130.8, name: 'Minor Seventh C3' }
    ],
    colors: ['bg-[#854d0e]', 'bg-[#a16207]', 'bg-[#ca8a04]', 'bg-[#facc15]', 'bg-[#fef08a]']
  },
  {
    id: 'cosmic',
    name: 'Cosmic Void 🪐',
    desc: 'Whole Tone Scale - Dreamlike, floating, unresolved.',
    notes: [
      { freq: 116.5, name: 'Root Bb2' },
      { freq: 130.8, name: 'Major Second C3' },
      { freq: 146.8, name: 'Major Third D3' },
      { freq: 164.8, name: 'Sharp Fourth E3' },
      { freq: 185.0, name: 'Sharp Fifth F#3' }
    ],
    colors: ['bg-[#a21caf]', 'bg-[#c084fc]', 'bg-[#e9d5ff]', 'bg-[#f3e8ff]', 'bg-[#faf5ff]']
  },
  {
    id: 'ethereal',
    name: 'Ethereal Wind 🍃',
    desc: 'Japanese Miyako-bushi - Dark, traditional, elegant.',
    notes: [
      { freq: 82.4, name: 'Root E2' },
      { freq: 87.3, name: 'Flat Second F2' },
      { freq: 110.0, name: 'Perfect Fourth A2' },
      { freq: 123.5, name: 'Perfect Fifth B2' },
      { freq: 130.8, name: 'Minor Sixth C3' }
    ],
    colors: ['bg-[#065f46]', 'bg-[#047857]', 'bg-[#10b981]', 'bg-[#34d399]', 'bg-[#a7f3d0]']
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Grid 🤖',
    desc: 'Diminished Scale - Industrial, robotic, metallic.',
    notes: [
      { freq: 65.4, name: 'Root C2' },
      { freq: 77.8, name: 'Minor Third Eb2' },
      { freq: 92.5, name: 'Tritone F#2' },
      { freq: 110.0, name: 'Major Sixth A2' },
      { freq: 123.5, name: 'Major Seventh B2' }
    ],
    colors: ['bg-[#9d174d]', 'bg-[#be185d]', 'bg-[#db2777]', 'bg-[#f472b6]', 'bg-[#fbcfe8]']
  },
  {
    id: 'radiance',
    name: 'Warm Radiance ☀️',
    desc: 'Major Pentatonic Overdrive - Bright, glowing, warm.',
    notes: [
      { freq: 130.8, name: 'Root C3' },
      { freq: 146.8, name: 'Major Second D3' },
      { freq: 164.8, name: 'Major Third E3' },
      { freq: 196.0, name: 'Perfect Fifth G3' },
      { freq: 220.0, name: 'Major Sixth A3' }
    ],
    colors: ['bg-[#ea580c]', 'bg-[#f97316]', 'bg-[#fb923c]', 'bg-[#ffedd5]', 'bg-[#fff7ed]']
  }
];

const INSPIRATION_PAGES = [
  {
    title: "Vocal Triggers",
    icon: "🎤",
    prompts: [
      "Sing a sustained vowel (Aah, Ooh, Mmm)",
      "Whistle a brief 3-note ascending melody",
      "Hum a low frequency drone to lock pitch",
      "Whisper sibilant sounds (Sss, Shhh, Phhh)"
    ]
  },
  {
    title: "Physical & Tap Triggers",
    icon: "🥁",
    prompts: [
      "Tap rhythmically on your tabletop or cup",
      "Make rapid claps or sharp finger snaps",
      "Rustle paper or shake keys close to mic",
      "Click your tongue with different pitches"
    ]
  },
  {
    title: "Playing an Instrument",
    icon: "🎸",
    prompts: [
      "Play a sustained chord on a keyboard",
      "Pluck a guitar string or strike a chime",
      "Blow a single note on a flute or recorder",
      "Tap a glass cup gently with a spoon"
    ]
  },
  {
    title: "Prompts to Improvise",
    icon: "🔮",
    prompts: [
      "Improvise a question and let echo answer",
      "Speak a poetic word, let it dissolve",
      "Imitate a machine-like pulse or clock tick",
      "Start extremely quiet, then finish loud"
    ]
  }
];

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
  const [pauseDurationMs, setPauseDurationMs] = useState<number>(600);
  const [overlapDuration, setOverlapDuration] = useState<number>(0.5); // overlapping slider
  const [chanceEffects, setChanceEffects] = useState({
    pitch: true,
    reverb: true,
    delay: true,
    tremolo: true,
    bitcrusher: true,
    ringmod: true,
    distortion: true,
    filter: true,
    flanger: true,
  });
  const [droneVolume, setDroneVolume] = useState<number>(50); // range 0 to 100
  const [showInspirationBox, setShowInspirationBox] = useState<boolean>(false);
  
  // Custom multi-page inspiration states & scale states
  const [selectedScaleId, setSelectedScaleId] = useState<string>('zen');
  const [inspirationPageIndex, setInspirationPageIndex] = useState<number>(0);

  const [extraPads, setExtraPads] = useState<any[]>([
    { id: 'pad-0', name: 'Root A2', colorClass: 'bg-[#8da99d]', colorName: 'Zen Garden 🌸', freq: 110.0, isPlaying: false },
    { id: 'pad-1', name: 'Major Third C#3', colorClass: 'bg-[#b6c7b9]', colorName: 'Zen Garden 🌸', freq: 138.6, isPlaying: false },
    { id: 'pad-2', name: 'Perfect Fifth E3', colorClass: 'bg-[#988bb5]', colorName: 'Zen Garden 🌸', freq: 164.8, isPlaying: false },
    { id: 'pad-3', name: 'Major Sixth F#3', colorClass: 'bg-[#8a9ca8]', colorName: 'Zen Garden 🌸', freq: 185.0, isPlaying: false },
    { id: 'pad-4', name: 'Octave A3', colorClass: 'bg-[#c2aa72]', colorName: 'Zen Garden 🌸', freq: 220.0, isPlaying: false }
  ]);
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
    engine.setOverlapDuration(overlapDuration);
    engine.setEnabledRandomEffects(chanceEffects);
    engine.setDroneVolume(droneVolume / 100);

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

  // Sync active drone pads to engine & clean up any dangling oscillators
  useEffect(() => {
    if (engineRef.current) {
      const activeFreqs = extraPads.filter(pad => pad.isPlaying).map(pad => pad.freq);
      engineRef.current.updateActiveDrones(activeFreqs);
    }

    const activeIds = new Set(extraPads.filter(pad => pad.isPlaying).map(pad => pad.id));
    
    // Safety lock: if no pads are active OR drone volume is 0%, force stop and disconnect ALL oscillators immediately
    if (activeIds.size === 0 || droneVolume === 0) {
      Object.keys(droneOscsRef.current).forEach(id => {
        const active = droneOscsRef.current[id];
        if (active) {
          try {
            active.osc.stop();
            active.osc.disconnect();
            active.gain.disconnect();
          } catch (e) {}
        }
      });
      droneOscsRef.current = {};
    } else {
      // Clean up any oscillators that are in droneOscsRef but are NOT active in extraPads state
      Object.keys(droneOscsRef.current).forEach(id => {
        if (!activeIds.has(id)) {
          const active = droneOscsRef.current[id];
          if (active) {
            try {
              active.osc.stop();
              active.osc.disconnect();
              active.gain.disconnect();
            } catch (e) {}
            delete droneOscsRef.current[id];
          }
        }
      });
    }
  }, [extraPads, droneVolume]);

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

  const handleOverlapDurationChange = (val: number) => {
    setOverlapDuration(val);
    if (engineRef.current) {
      engineRef.current.setOverlapDuration(val);
    }
  };

  // Change active scale & glide frequencies
  const handleScaleChange = (scaleId: string) => {
    setSelectedScaleId(scaleId);
    const newScale = DRONE_SCALES.find(s => s.id === scaleId) || DRONE_SCALES[0];
    
    setExtraPads(prev => {
      return newScale.notes.map((note, index) => {
        const existingPad = prev[index];
        const isPlaying = existingPad ? existingPad.isPlaying : false;
        const id = existingPad ? existingPad.id : `pad-${index}`;
        
        if (isPlaying) {
          const active = droneOscsRef.current[id];
          if (active) {
            const ctx = engineRef.current?.getAudioContext();
            if (ctx) {
              try {
                active.osc.frequency.setValueAtTime(active.osc.frequency.value, ctx.currentTime);
                active.osc.frequency.exponentialRampToValueAtTime(note.freq, ctx.currentTime + 2.0);
              } catch (e) {
                try {
                  active.osc.frequency.linearRampToValueAtTime(note.freq, ctx.currentTime + 2.0);
                } catch (err) {}
              }
            }
          }
        }

        return {
          id,
          name: note.name,
          colorClass: newScale.colors[index % newScale.colors.length],
          colorName: newScale.name,
          freq: note.freq,
          isPlaying,
        };
      });
    });
  };

  const handleCentralNodeClick = () => {
    if (!engineRef.current) return;
    
    if (audioState === 'playing_answer') {
      engineRef.current.skipReplyingAndStartNewRound();
    } else if (audioState === 'waiting_for_sound') {
      engineRef.current.startRecordingManually();
    } else if (audioState === 'recording_sound') {
      engineRef.current.stopRecordingManually();
    }
  };

  const handleChanceEffectToggle = (key: keyof typeof chanceEffects) => {
    const updated = {
      ...chanceEffects,
      [key]: !chanceEffects[key]
    };
    setChanceEffects(updated);
    if (engineRef.current) {
      engineRef.current.setEnabledRandomEffects(updated);
    }
  };

  const handleDroneVolumeChange = (val: number) => {
    setDroneVolume(val);
    const volumeFactor = val / 100;
    if (engineRef.current) {
      engineRef.current.setDroneVolume(volumeFactor);
    }
    const ctx = engineRef.current?.getAudioContext();
    if (ctx) {
      Object.values(droneOscsRef.current).forEach((active: any) => {
        try {
          if (volumeFactor === 0) {
            // Instantly and absolutely cut the sound to prevent any leakage
            active.gain.gain.cancelScheduledValues(ctx.currentTime);
            active.gain.gain.setValueAtTime(0, ctx.currentTime);
          } else {
            active.gain.gain.setValueAtTime(active.gain.gain.value, ctx.currentTime);
            active.gain.gain.linearRampToValueAtTime(0.08 * volumeFactor, ctx.currentTime + 0.15);
          }
        } catch (e) {}
      });
    }
  };

  // Toggle ambient synthesizer drone
  const toggleDronePad = (padId: string, freq: number) => {
    const ctx = engineRef.current?.getAudioContext();
    if (!ctx) {
      alert("Please press 'Start Session' first to power on the audio engine workbench!");
      return;
    }

    const pad = extraPads.find(p => p.id === padId);
    if (!pad) return;
    const isNowPlaying = !pad.isPlaying;

    if (isNowPlaying) {
      try {
        // Stop and disconnect any existing oscillator for this padId first to prevent memory/audio leaks!
        const existing = droneOscsRef.current[padId];
        if (existing) {
          try {
            existing.osc.stop();
            existing.osc.disconnect();
            existing.gain.disconnect();
          } catch (e) {}
          delete droneOscsRef.current[padId];
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        // Soft background volume scaled by droneVolume
        gain.gain.setValueAtTime(0, ctx.currentTime);
        const targetGain = 0.08 * (droneVolume / 100);
        gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 1.2); // sweet fade-in
        
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
          active.gain.gain.cancelScheduledValues(ctx.currentTime);
          active.gain.gain.setValueAtTime(active.gain.gain.value, ctx.currentTime);
          active.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
          active.osc.stop(ctx.currentTime + 0.06);
          setTimeout(() => {
            try {
              active.osc.disconnect();
              active.gain.disconnect();
            } catch (err) {}
          }, 100);
        } catch (err) {}
        delete droneOscsRef.current[padId];
      }
    }

    // Safely update the state using a pure, side-effect-free mapper function
    setExtraPads(prev => prev.map(p => p.id === padId ? { ...p, isPlaying: isNowPlaying } : p));
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

        // No automatic drone starting on session start (only start when explicitly activated)
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
    
    // Stop and disconnect all active background drones
    Object.values(droneOscsRef.current).forEach((active: any) => {
      try {
        active.osc.stop();
        active.osc.disconnect();
        active.gain.disconnect();
      } catch (e) {}
    });
    droneOscsRef.current = {};
    setExtraPads(prev => prev.map(pad => ({ ...pad, isPlaying: false })));

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
    <div id="sound_imp_app" className="min-h-screen bg-[#FAF6ED] text-zinc-950 font-sans selection:bg-zinc-950/10 flex flex-col antialiased">
      {/* Ambient Status Shimmer/Pulse Border & Glow */}
      {audioState === 'recording_sound' && (
        <div className="fixed inset-0 pointer-events-none z-50 bg-rose-500/[0.03] border-[12px] border-rose-600/30 animate-pulse shadow-[inset_0_0_100px_rgba(225,29,72,0.25)] transition-all duration-700" />
      )}
      {audioState === 'playing_answer' && (
        <div className="fixed inset-0 pointer-events-none z-50 bg-blue-500/[0.03] border-[12px] border-blue-600/30 animate-pulse shadow-[inset_0_0_100px_rgba(37,99,235,0.25)] transition-all duration-700" />
      )}

      {/* Visual Title / Header following soundcomp look exactly */}
      <header className="py-8 px-4 flex flex-col items-center">
        <h1 className="font-display font-black text-5xl md:text-6xl text-zinc-950 tracking-tight text-center uppercase select-none">
          sound_imp
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
            className="max-w-md w-full bg-[#FAF3D1] border-2 border-zinc-950 p-4 mt-5 text-center text-xs font-mono text-zinc-900 shadow-xs retro-shadow-sm rounded-none min-h-[220px] flex flex-col justify-between"
          >
            <div>
              {/* Header with page title & pagination controls */}
              <div className="flex items-center justify-between border-b border-zinc-950/20 pb-1.5 mb-2.5 select-none">
                <span className="font-black text-zinc-950 uppercase tracking-wide flex items-center gap-1">
                  <span>{INSPIRATION_PAGES[inspirationPageIndex].icon}</span>
                  <span>{INSPIRATION_PAGES[inspirationPageIndex].title}</span>
                </span>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setInspirationPageIndex(prev => (prev - 1 + INSPIRATION_PAGES.length) % INSPIRATION_PAGES.length)}
                    className="p-1 border border-zinc-950 bg-[#FAF6ED] hover:bg-zinc-950 hover:text-white transition-colors cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="h-3 w-3 text-current" />
                  </button>
                  <span className="text-[9px] font-black tracking-widest text-zinc-600 px-1">
                    {inspirationPageIndex + 1}/{INSPIRATION_PAGES.length}
                  </span>
                  <button
                    onClick={() => setInspirationPageIndex(prev => (prev + 1) % INSPIRATION_PAGES.length)}
                    className="p-1 border border-zinc-950 bg-[#FAF6ED] hover:bg-zinc-950 hover:text-white transition-colors cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="h-3 w-3 text-current" />
                  </button>
                </div>
              </div>

              {/* Grid with 4 items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] text-left text-zinc-800">
                {INSPIRATION_PAGES[inspirationPageIndex].prompts.map((prompt, index) => (
                  <div key={index} className="flex items-start gap-1">
                    <span className="text-zinc-500 font-bold shrink-0">&bull;</span>
                    <span className="leading-tight">{prompt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination dot indicator footer */}
            <div className="flex justify-center gap-1.5 mt-4 pt-2 border-t border-zinc-950/5 select-none">
              {INSPIRATION_PAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setInspirationPageIndex(i)}
                  className={`h-1.5 w-1.5 rounded-full transition-all cursor-pointer ${
                    inspirationPageIndex === i ? 'bg-zinc-950 scale-125' : 'bg-zinc-950/20 hover:bg-zinc-950/50'
                  }`}
                />
              ))}
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
            <div className="bg-[#b3b19a] border-2 border-zinc-950 rounded-none p-6 retro-shadow flex flex-col justify-between items-center relative overflow-hidden min-h-[480px] transition-all duration-300 z-10">
              
              {/* Real-time Oscilloscope Transparent Background */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.16] z-0">
                <WaveVisualizer
                  dataArray={visualData.dataArray}
                  rms={visualData.rms}
                  isInput={visualData.isInput}
                  isActive={audioState !== 'idle'}
                  state={audioState}
                  transparentBg={true}
                />
              </div>

              {/* Soft background decor based on state */}
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[80px] transition-all duration-1000 ${
                  audioState === 'waiting_for_sound' ? 'bg-zinc-500/20' :
                  audioState === 'recording_sound' ? 'bg-rose-500/35' :
                  audioState === 'playing_answer' ? 'bg-[#b0a2be]/45' : 'bg-transparent'
                }`} />
              </div>

              {/* Top/Center content */}
              <div className="w-full flex flex-col items-center justify-center h-[350px] md:h-[370px] z-10 py-4 relative">
                <AnimatePresence mode="wait">
                  {audioState === 'idle' ? (
                    // IDLE VIEW: Start Session Trigger
                    <motion.div 
                      key="idle"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex flex-col items-center text-center gap-4"
                    >
                      <button
                        onClick={() => startSession(false)}
                        title="Click to Start Session"
                        className="h-14 w-14 rounded-full bg-white flex items-center justify-center text-zinc-950 border-2 border-dashed border-zinc-950 animate-bounce cursor-pointer hover:bg-[#FAF3D1] transition-all duration-300 active:scale-95 outline-none"
                      >
                        <Mic className="h-7 w-7 text-zinc-950" />
                      </button>
                      <div>
                        <h2 className="font-display font-black text-xl uppercase tracking-tight text-zinc-950">Make a sound.</h2>
                        <p className="text-xs text-zinc-900 font-mono max-w-[360px] mt-1.5 leading-relaxed font-bold uppercase tracking-wide">
                          Speak, sing, play or tap!
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    // ACTIVE RUNNING VIEW: Displays current state cues
                    <motion.div 
                      key="active"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="w-full flex flex-col items-center gap-5"
                    >
                      {/* The Giant Audio Pulse Ring */}
                      <div className="relative flex items-center justify-center h-36 w-36">
                        
                        {/* State outer ripple circle */}
                        <div className={`absolute inset-0 rounded-full transition-all duration-700 border-2 ${
                          audioState === 'waiting_for_sound' ? 'border-dashed border-emerald-600/60 scale-100 animate-pulse' :
                          audioState === 'recording_sound' ? 'border-rose-600 animate-pulse' :
                          audioState === 'playing_answer' ? 'border-blue-600 animate-pulse' : 'border-zinc-500 scale-90'
                        }`} />

                        <div className={`absolute inset-2.5 rounded-full transition-all duration-700 border ${
                          audioState === 'waiting_for_sound' ? 'border-dashed border-emerald-600/30 bg-emerald-50/[0.03]' :
                          audioState === 'recording_sound' ? 'border-rose-600/30 bg-rose-50/10 scale-105' :
                          audioState === 'playing_answer' ? 'border-blue-600/30 bg-blue-50/10 scale-105' : 'border-zinc-600'
                        }`} />

                        {/* State Central Node Core */}
                        <button
                          onClick={handleCentralNodeClick}
                          disabled={audioState === 'initializing' || audioState === 'processing'}
                          title={
                            audioState === 'playing_answer' ? 'Click to Stop Reply and Start New Round' :
                            audioState === 'waiting_for_sound' ? 'Click to Start Recording Manually' :
                            audioState === 'recording_sound' ? 'Click to Stop Recording Manually' : undefined
                          }
                          className={`h-24 w-24 rounded-full flex flex-col items-center justify-center text-[#FAF6ED] transition-all duration-500 shadow-md border-2 border-zinc-950 outline-none ${
                            audioState === 'initializing' ? 'bg-zinc-400 cursor-not-allowed' :
                            audioState === 'waiting_for_sound' ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer hover:ring-4 hover:ring-emerald-600/25 active:scale-95 animate-pulse' :
                            audioState === 'recording_sound' ? 'bg-rose-600 scale-105 cursor-pointer hover:ring-4 hover:ring-rose-600/25 active:scale-95' :
                            audioState === 'processing' ? 'bg-amber-500 animate-pulse cursor-not-allowed' :
                            audioState === 'playing_answer' ? 'bg-blue-600 scale-105 hover:bg-blue-700 cursor-pointer active:scale-95 hover:ring-4 hover:ring-blue-600/25' : 'bg-zinc-50 cursor-default'
                          }`}
                        >
                          {audioState === 'initializing' && <span className="text-[10px] font-mono tracking-widest font-black uppercase">BOOTING</span>}
                          
                          {audioState === 'waiting_for_sound' && (
                            <div className="flex flex-col items-center gap-1">
                              <Mic className="h-5 w-5 text-white animate-pulse" />
                              <span className="text-[8px] font-mono tracking-widest uppercase text-white font-bold">START REC</span>
                              <span className="text-[6px] font-mono tracking-wider opacity-75 uppercase text-white">OR SPEAK</span>
                            </div>
                          )}

                          {audioState === 'recording_sound' && (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                              <span className="text-[8px] font-mono tracking-widest font-black text-white uppercase">STOP REC</span>
                              <span className="text-[6px] font-mono tracking-wider opacity-75 uppercase text-white">TAP TO REPLY</span>
                            </div>
                          )}

                          {audioState === 'processing' && (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex gap-1">
                                <span className="h-1 w-1 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                                <span className="h-1 w-1 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                                <span className="h-1 w-1 rounded-full bg-white animate-bounce" />
                              </div>
                              <span className="text-[8px] font-mono tracking-widest">SYNTHESIZING</span>
                            </div>
                          )}

                          {audioState === 'playing_answer' && (
                            <div className="flex flex-col items-center gap-1">
                              <Volume2 className="h-5 w-5 animate-pulse text-white" />
                              <span className="text-[8px] font-mono tracking-widest uppercase text-white font-bold">SKIP REPLY</span>
                              <span className="text-[6px] font-mono tracking-wider opacity-75 uppercase">STOP & NEXT</span>
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Interactive Text Prompt */}
                      <div className="text-center px-4">
                        <h3 className="font-display font-black text-xl text-zinc-950 tracking-tight uppercase transition-colors duration-300">
                          {audioState === 'initializing' && 'ARMING WORKBENCH...'}
                          {audioState === 'waiting_for_sound' && 'Make a sound.'}
                          {audioState === 'recording_sound' && 'Sound active... Recording...'}
                          {audioState === 'processing' && 'Synthesizing creative answer...'}
                          {audioState === 'playing_answer' && 'Responding...'}
                        </h3>
                        
                        <p className="text-[11px] text-zinc-900 font-mono mt-0.5 max-w-[340px] mx-auto leading-relaxed h-5 font-bold">
                          {audioState === 'waiting_for_sound' && 'Speak, sing, play or tap!'}
                          {audioState === 'recording_sound' && 'Stop making sound to trigger playback.'}
                          {audioState === 'processing' && 'Rendering audio effects graph offline...'}
                          {audioState === 'playing_answer' && 'Listen to the modified replication.'}
                        </p>
                      </div>

                      {/* Active effects overlay during playback */}
                      {audioState === 'playing_answer' && activeEffects.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center max-w-[340px]">
                          {activeEffects.map((eff, i) => (
                            <span 
                              key={i} 
                              className="text-[9px] font-mono font-black bg-zinc-950 text-[#FAF6ED] px-2 py-0.5 border border-zinc-950 shadow-xs uppercase"
                            >
                              {eff}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Recording metadata tag */}
                      {isRecording && (
                        <div className="flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-0.5 border border-rose-900/30 text-[9px] font-mono font-bold uppercase tracking-wider mt-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
                          REC ACTIVE &bull; {recordedCount} ROUND{recordedCount !== 1 ? 'S' : ''} SAVED
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>



              {/* INTEGRATED SESSION CONTROL DESK */}
              <div className="w-full mt-4 pt-4 border-t-2 border-zinc-950/20 z-10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-black uppercase text-zinc-900 tracking-wider">
                    Session Control Desk
                  </span>
                  {isRecording && (
                    <span className="text-[8px] font-mono font-black text-rose-800 bg-rose-50 px-2 py-0.5 border border-rose-900/20 uppercase animate-pulse">
                      Recording Active
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => startSession(false)}
                    disabled={audioState !== 'idle'}
                    className={`flex-1 font-mono text-[10px] font-black py-3 border-2 border-zinc-950 flex items-center justify-center gap-1.5 rounded-none uppercase transition-all ${
                      audioState === 'idle'
                        ? 'bg-[#FAF6ED] text-zinc-950 hover:bg-[#FAF3D1] cursor-pointer retro-shadow-xs'
                        : 'bg-zinc-250/50 text-zinc-500 border-zinc-450 pointer-events-none opacity-50'
                    }`}
                  >
                    <Play className="h-3 w-3 fill-current text-zinc-950" />
                    <span>Start Session</span>
                  </button>

                  <button
                    onClick={() => startSession(true)}
                    disabled={audioState !== 'idle'}
                    className={`flex-1 font-mono text-[10px] font-black py-3 border-2 border-zinc-950 flex items-center justify-center gap-1.5 rounded-none uppercase transition-all ${
                      audioState === 'idle'
                        ? 'bg-rose-600 text-white hover:bg-rose-700 cursor-pointer retro-shadow-xs'
                        : 'bg-zinc-250/50 text-zinc-500 border-zinc-450 pointer-events-none opacity-50'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    <span>Record Session</span>
                  </button>

                  <button
                    onClick={stopSession}
                    disabled={audioState === 'idle'}
                    className={`flex-1 font-mono text-[10px] font-black py-3 border-2 border-zinc-950 flex items-center justify-center gap-1.5 rounded-none uppercase transition-all ${
                      audioState !== 'idle'
                        ? 'bg-zinc-950 text-white hover:bg-zinc-800 cursor-pointer retro-shadow-xs'
                        : 'bg-zinc-150 text-zinc-300 border-zinc-200 pointer-events-none'
                    }`}
                  >
                    <Square className="h-3 w-3 fill-current text-white" />
                    <span>Stop & Export</span>
                  </button>
                </div>
              </div>
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

              {/* Box 3: Toggleable Chance Effects Selector pool */}
              <div className="flex flex-col gap-3.5 p-5 bg-white border-2 border-zinc-950 rounded-none retro-shadow">
                <div className="flex items-center justify-between border-b border-zinc-950/15 pb-2">
                  <h4 className="text-xs font-mono font-black text-zinc-950 uppercase flex items-center gap-1.5 select-none">
                    <Sparkles className="h-4 w-4 text-zinc-950 animate-pulse" />
                    CHANCE EFFECTS POOL (ROLL GATE)
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const allOn = { pitch: true, reverb: true, delay: true, tremolo: true, bitcrusher: true, ringmod: true, distortion: true, filter: true, flanger: true };
                        setChanceEffects(allOn);
                        if (engineRef.current) engineRef.current.setEnabledRandomEffects(allOn);
                      }}
                      className="text-[9px] font-mono font-black hover:underline cursor-pointer uppercase text-zinc-600"
                    >
                      All On
                    </button>
                    <span className="text-zinc-400 font-mono text-[9px]">|</span>
                    <button
                      onClick={() => {
                        const allOff = { pitch: false, reverb: false, delay: false, tremolo: false, bitcrusher: false, ringmod: false, distortion: false, filter: false, flanger: false };
                        setChanceEffects(allOff);
                        if (engineRef.current) engineRef.current.setEnabledRandomEffects(allOff);
                      }}
                      className="text-[9px] font-mono font-black hover:underline cursor-pointer uppercase text-zinc-600"
                    >
                      All Off
                    </button>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-zinc-600 uppercase leading-snug font-bold">
                  Toggle which DSP algorithms are randomized and applied to your sound during active improvisation. If all are disabled, audio remains completely clean.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 mt-1">
                  {[
                    { key: 'pitch', label: 'Pitch Shift', desc: 'Chipmunk/Giant', icon: '🐿️' },
                    { key: 'reverb', label: 'Reverb Space', desc: 'Ambient Room', icon: '🌌' },
                    { key: 'delay', label: 'Echo Delay', desc: 'Slapback/Dub', icon: '⏱️' },
                    { key: 'tremolo', label: 'Pulse Tremolo', desc: 'Volume LFO', icon: '📳' },
                    { key: 'bitcrusher', label: 'Lo-Fi Bitcrush', desc: 'Bit Quantizer', icon: '👾' },
                    { key: 'flanger', label: 'Space Flanger', desc: 'Phase Sweeps', icon: '🌀' },
                    { key: 'ringmod', label: 'Ring Mod', desc: 'Metallic Robot', icon: '🤖' },
                    { key: 'distortion', label: 'Fuzz Clipper', desc: 'Crunchy Overdrive', icon: '🔥' },
                    { key: 'filter', label: 'Filter Sweep', desc: 'Sub/Radio Sweeps', icon: '📻' },
                  ].map((item) => {
                    const isChecked = chanceEffects[item.key as keyof typeof chanceEffects];
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleChanceEffectToggle(item.key as keyof typeof chanceEffects)}
                        className={`flex flex-col items-start p-2.5 border-2 border-zinc-950 transition-all select-none text-left cursor-pointer ${
                          isChecked
                            ? 'bg-[#FAF6ED] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-zinc-50 border-dashed border-zinc-400 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 w-full justify-between">
                          <span className="text-xs font-mono font-black text-zinc-950 flex items-center gap-1">
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </span>
                          <span className={`h-3.5 w-3.5 border border-zinc-950 rounded-none flex items-center justify-center text-[8px] font-black ${isChecked ? 'bg-zinc-950 text-white' : 'bg-transparent'}`}>
                            {isChecked && '✓'}
                          </span>
                        </div>
                        <span className="text-[8px] font-mono text-zinc-500 font-bold mt-1 uppercase">
                          {item.desc}
                        </span>
                      </button>
                    );
                  })}
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

                  <div className="flex flex-col gap-1 mt-3">
                    <div className="flex justify-between">
                      <span>OVERLAPPING</span>
                      <span>{overlapDuration.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2.0"
                      step="0.1"
                      value={overlapDuration}
                      onChange={(e) => handleOverlapDurationChange(parseFloat(e.target.value))}
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
                </div>
              </div>



            </div>

          </div>

          {/* RIGHT COLUMN: History & Documentation / User Manual (5 columns) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Deck 1: Historic tape reel rolls (History list - Sage Green background matching Pad 3) */}
            <div className="bg-[#8da99d] border-2 border-zinc-950 p-5 retro-shadow rounded-none">
              <ImprovHistory 
                rounds={rounds} 
                onClear={clearRounds} 
                engine={engineRef.current} 
                audioState={audioState} 
              />
            </div>

            {/* Deck 2: System User Manual */}
            <SoundImproHelp />

          </div>

        </div>

        {/* Ambient Synthesizer Drone Deck at the bottom */}
        <div className="border-2 border-zinc-950 p-5 bg-white retro-shadow mt-2 flex flex-col gap-4 rounded-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-950/15 pb-3 gap-4">
            <div>
              <span className="font-display font-black text-sm tracking-widest text-zinc-950 uppercase block">
                Ambient Drones Base
              </span>
              <span className="text-[10px] text-zinc-600 font-mono block mt-1 leading-relaxed font-bold">
                CURRENT SCALE: <span className="text-zinc-950 font-black">{DRONE_SCALES.find(s => s.id === selectedScaleId)?.name}</span> ({DRONE_SCALES.find(s => s.id === selectedScaleId)?.desc})
              </span>
            </div>
            
            {/* Drone volume fader and Scale Selector */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Scale Dropdown Selector */}
              <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-950/20 px-3 py-1.5 rounded-none font-mono text-[10px]">
                <span className="font-black text-zinc-700 uppercase">SCALE:</span>
                <select
                  value={selectedScaleId}
                  onChange={(e) => handleScaleChange(e.target.value)}
                  className="bg-white border-2 border-zinc-950 px-2 py-1 text-[10px] font-black uppercase text-zinc-950 outline-none cursor-pointer rounded-none"
                >
                  {DRONE_SCALES.map((scale) => (
                    <option key={scale.id} value={scale.id}>
                      {scale.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-950/20 px-3 py-1.5 rounded-none font-mono text-[10px]">
                <span className="font-black text-zinc-700 uppercase">DRONE VOL:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={droneVolume}
                  onChange={(e) => handleDroneVolumeChange(parseInt(e.target.value))}
                  className="w-24 accent-zinc-950 h-1 bg-zinc-300 rounded-none appearance-none cursor-pointer animate-none"
                  style={{ accentColor: '#000000' }}
                />
                <span className="font-black text-zinc-950 w-8 text-right">{droneVolume}%</span>
              </div>
            </div>
          </div>

          {/* Scale Voice Pads representing the 5 scale notes */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mt-1">
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
                  <span className="text-base font-display font-black text-zinc-950 block mt-0.5">{pad.freq.toFixed(1)} Hz</span>
                  <span className="text-[8px] font-mono text-zinc-600 block mt-0.5">{pad.colorName}</span>
                </div>

                <div className="text-[9px] font-mono font-black text-zinc-950 text-center uppercase tracking-wider">
                  {pad.isPlaying ? "🔊 Stream Active" : "🔇 Powered Off"}
                </div>
              </motion.div>
            ))}
          </div>
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
            <span className="font-bold text-zinc-950 block">sound_imp &bull; Conversational Sound Lab</span>
            <span className="text-[10px] text-zinc-500">Continuous sound synthesis & back-and-forth responsive improvisation.</span>
            <span className="text-[11px] text-zinc-700 block mt-2 font-bold">
              App by Philip and Google AI Studio / If you have any questions or feedback, please contact me:{' '}
              <a href="mailto:p.stade@mh-freiburg.de" className="underline hover:text-zinc-950">
                p.stade@mh-freiburg.de
              </a>
            </span>
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
