# sound_impro 🎛️

An elegant, analog-inspired conversational sound improvisation workbench. It listens to you make a sound, detects when you stop speaking, processes your voice with complex effects (pitch, speed, reverb, delay, robot, alien), and replies with a creative synthesized answer. 

Developed following the visual and aesthetic design of [soundcomp](https://soundcomp.vercel.app/).

---

## 🎨 Visual Redesign & Aesthetic Alignments
1. **Premium Palette & Typography**: Transformed the styling from a generic dark mode into an eye-safe pastel bento layout:
   - **Pad 1 (Lavender - Control)**: `#b0a2be`
   - **Pad 2 (Khaki/Olive - Engine)**: `#b3b19a` (flashes red when live stream audio is active!)
   - **Pad 3 (Sage Green - Monitor)**: `#8da99d`
   - **Display Heading**: Space Grotesk-inspired heavy display sans with a custom triple-dot spacer `|·|·|`.
2. **Horizontal-Vertical Rhythm**: Re-arranged the controls into responsive bento blocks corresponding exactly to physical tabletop synthesis gear.
3. **Capsule Controls Bar**: Rounded black pill capsules for "Start Session", "Record Session", and "Stop Session".

---

## 🚀 Key Functional Features Implemented
* **Real-time Conversation Engine**: Automatically triggers recording upon voice onset, detects silent pauses using a dynamic RMS gating algorithm, and plays back pitch-transposed, modulated responses.
* **Complex Effects Pipeline**: Offline rendering graph with:
  * Vibrato LFO delay frequency modulation.
  * Ring Modulator (alien robotic voice synthesis).
  * Convolution Reverb and custom feedback delay lines.
  * Biquad Highpass/Lowpass filtering.
* **Fixed WAV Export System**: Corrected the export click bug by pre-rendering WAV files as stable client-side object URLs linked with native HTML5 downloading anchors. 
* **Custom File Uploading**: Pad 1 supports drag-and-drop or file selector uploads of custom audio files (WAV, MP3, etc.) to immediately trigger creative synthesized replies.
* **Ambient Drone Synthesizer (+ Add Pad)**: Центрированный "+ Add Pad" button spawns additional retro pads with low-frequency triangle oscillators and soft lowpass filters to generate beautiful background chords/drones.

---

## 🛠️ Step-by-Step Architecture Steps Taken
1. **Audio Capture Setup**: Initialized `AudioContext` with standard sample rate matching user device stream permissions.
2. **Dynamic Gating Logic**: Designed procedural real-time measurement of signal RMS.
3. **Effects Processing Graph**: Modeled DSP parameters inside a multi-channel `OfflineAudioContext` for CPU-safe rendering.
4. **WAV File Serialization**: Wrote an efficient `bufferToWav` encoder converting raw float channels into 16-bit PCM WAV blobs.
5. **Soundcomp Theme Overhaul**: Redesigned `/src/App.tsx` and modified CSS variables inside `/src/index.css`.
6. **File Export Resolution**: Pre-calculated downloadable links inside the State Machine container.
