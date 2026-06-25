export type AudioState =
  | 'idle'
  | 'initializing'
  | 'waiting_for_sound'  // Active mic, waiting for onset threshold ("Make a sound")
  | 'recording_sound'    // Active sound being recorded
  | 'processing'         // Decoding audio and applying effects
  | 'playing_answer';    // Playback of response with effects

export interface ImprovRound {
  id: string;
  timestamp: string;
  durationSec: number;
  effectsApplied: string[];
  intensity: number; // 0 to 100
  userAudioUrl?: string; // Optional URL to play the original recording
}

export interface EffectSettings {
  pitchRate: number;      // Playback speed/pitch multiplier (e.g., 0.5 to 2.0)
  reverbWet: number;      // Wet mix for convolver reverb (0 to 1)
  delayTime: number;      // Feedback delay time in seconds (0 to 1)
  delayFeedback: number;  // Feedback gain (0 to 0.9)
  delayWet: number;       // Wet mix for delay (0 to 1)
  distortionAmount: number; // WaveShaper distortion (0 to 150)
  filterType: 'none' | 'lowpass' | 'highpass' | 'bandpass';
  filterFrequency: number; // Frequency in Hz
  vibratoRate: number;    // LFO frequency in Hz (0 to 10)
  vibratoDepth: number;   // LFO depth in seconds (0 to 0.01)
  ringModFreq: number;    // Ring modulator carrier frequency (0 to 200 Hz)
  ringModWet: number;     // Wet mix for ring modulation (0 to 1)
}
