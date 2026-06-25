# sound_impro 🎛️

An elegant, analog-inspired conversational sound improvisation workbench. It listens to you make a sound, detects when you stop speaking, processes your voice with complex effects, and replies with a creative synthesized answer.

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
4. **Session Control Desk Integration**: Moved the recording control station up to the very first bento layout section so mobile users don't have to scroll far down to toggle recordings or stop sessions.

---

## 🚀 Key Functional Features Implemented

* **Real-time Conversation Engine**: Automatically triggers recording upon voice onset, detects silent pauses using a dynamic RMS gating algorithm, and plays back pitch-transposed, modulated responses.
* **Complex Effects Pipeline**: Offline rendering graph with:
  * Vibrato LFO delay frequency modulation.
  * Ring Modulator (alien robotic voice synthesis).
  * Convolution Reverb and custom feedback delay lines.
  * Biquad Highpass/Lowpass filtering.
* **Interactive Chance Effects Selector (Roll Gate)**: 
  * A dedicated bento panel to customize the DSP chance matrix.
  * Choose precisely which effects (Pitch Shift, Reverb, Delay, Vibrato, Ring Modulation, Distortion, and Filter Sweeps) are allowed to be added by chance to your sound.
  * Quick-control toggles for **All On** and **All Off**.
* **Fixed WAV Export System**: Corrected the export click bug by pre-rendering WAV files as stable client-side object URLs linked with native HTML5 downloading anchors. Includes raw, processed, and combined session modes.
* **Multi-Layer Ambient Drone Synth**: 
  * Spawn low-frequency triangle oscillators and soft lowpass filters to generate beautiful background chords.
  * **Minor & Tension Tuning**: Tuned the drone pads' base frequency and interval relationships to minor chords and high-tension intervals (minor seconds, tritones, diminished fifths) for a dark, dramatic, cinematic soundscapes.
  * **Drone Session Mix**: The complete recording system mixes the ambient background drones directly into the downloadable "Full Continuous Session" file.
* **Instant-Skip "Make a Sound" Button**:
  * Converted the central state display node into an active button.
  * When clicked during the reply playback (`playing_answer`), it halts playback immediately and resets the state to `waiting_for_sound` for the next round instantly.
* **Enhanced Session Log Tape**:
  * Displays three distinct functionalities per round for deep musical experimentation:
    1. **Loop Switch**: Loop individual round playbacks infinitely.
    2. **Play Own Recording**: Replay your raw, un-effected voice input.
    3. **Play Reply**: Replay the processed sound response with its corresponding DSP effects.
  * **Layering & Polyphony**: Allows users to loop, toggle, and layer different rounds on top of each other concurrently!

---

## 🛠️ Step-by-Step Architecture Steps Taken

1. **Audio Capture Setup**: Initialized `AudioContext` with standard sample rate matching user device stream permissions.
2. **Dynamic Gating Logic**: Designed procedural real-time measurement of signal RMS.
3. **Effects Processing Graph**: Modeled DSP parameters inside a multi-channel `OfflineAudioContext` for CPU-safe rendering.
4. **WAV File Serialization**: Wrote an efficient `bufferToWav` encoder converting raw float channels into 16-bit PCM WAV blobs.
5. **Audio Engine Polyphony Upgrades**: Maintained an active registry of concurrent `AudioBufferSourceNode` nodes to handle overlapping loops from the history logs without interrupting the main real-time conversational thread.
6. **Soundcomp Theme Overhaul**: Redesigned `/src/App.tsx` and modified CSS variables inside `/src/index.css`.
7. **File Export Resolution**: Pre-calculated downloadable links inside the State Machine container.
