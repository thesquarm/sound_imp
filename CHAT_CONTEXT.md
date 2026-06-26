# Chat & Development Context Log

This document preserves the full development history, user requests, code modifications, and state configurations of this session for future context and reference.

---

## 📌 Context Summary & Key Milestones

1. **Central State Node Upgrade ("Make a Sound")**
   - **User Request**: Make the round symbol of "Speak now" a button. When you push it, the answering reply stops immediately and a new round begins. Also rename "Speak now" to "Make a sound".
   - **Implementation**:
     - Converted the central circle from a static `div` to a custom interactive `button`.
     - Renamed the label from "SPEAK NOW" to "MAKE A SOUND".
     - Implemented `skipReplyingAndStartNewRound()` inside the `AudioEngine` class. It stops the active reply buffer (`activeSourceNode`) immediately, which triggers the `onended` event handler to transition the state back to `waiting_for_sound` and reset variables cleanly.

2. **Session Log Tape (Enhanced 3-Way Polyphony Controls)**
   - **User Request**: Show 3 functional controls in the session log tape:
     1. **Loop Switch**: Loop individual rounds infinitely.
     2. **Play Own Recording**: Replay the original raw user audio input.
     3. **Play Reply**: Replay the processed answer buffer containing applied sound effects.
   - **Implementation**:
     - Upgraded `ImprovHistory` with React states `playingRaw`, `playingProcessed`, and `loopingRounds`.
     - Maintained a map of active concurrent playback nodes (`roundBuffers` and `activeHistorySources`) inside the `AudioEngine`. This allows users to trigger/loop/layer multiple historical sounds at once (creating an elegant ambient layer cake) without blocking the primary live real-time mic pipeline!
     - Mapped raw and processed audio buffers cleanly per `roundId` using stable, unique generated IDs rather than array index lookups (fixing historical desync bugs).

3. **Chance Effects Pool (Roll Gate Filter)**
   - **User Request**: Add another box where the user can choose which effects should be added by chance and which should not. At the beginning, all effects are selected.
   - **Implementation**:
     - Added a stateful `chanceEffects` dictionary inside `App.tsx`:
       ```typescript
       const [chanceEffects, setChanceEffects] = useState({
         pitch: true,
         reverb: true,
         delay: true,
         vibrato: true,
         ringmod: true,
         distortion: true,
         filter: true
       });
       ```
     - Designed a beautiful bento block section featuring high-contrast toggle buttons with active checkmark states and descriptions for each of the 7 DSP effect slots.
     - Added convenient "All On" and "All Off" helper links.
     - Synchronized the active state with `AudioEngine.setEnabledRandomEffects()`, which masks the random roll logic inside the parameters selector.

4. **Dark Tension Drone Preset Tuning**
   - **User Request**: Tuned the procedural drone synthesizers to minor components and high-tension intervals (minor seconds, tritones, diminished fifths) rather than standard major scales, complementing a dark cinematic soundscape.
   - **Implemented Frequencies**:
     - `110.0 Hz` (Deep Root A2)
     - `130.8 Hz` (Dark Minor Third C3)
     - `146.8 Hz` (Suspended Fourth D3)
     - `155.6 Hz` (Tension Tritone D#3)
     - `174.6 Hz` (Dramatic Minor Sixth F3)
     - `196.0 Hz` (Moody Minor Seventh G3)
     - `246.9 Hz` (Tension Ninth B3)

---

## 🗃️ Relevant File Implementations & Code Snippets

### Skip Reply Handler (`src/utils/audioEngine.ts`)
```typescript
public skipReplyingAndStartNewRound() {
  if (this.currentState === 'playing_answer' && this.activeSourceNode) {
    try {
      this.activeSourceNode.stop();
    } catch (e) {}
    this.activeSourceNode = null;
  }
}
```

### Random Effects Masking Logic (`src/utils/audioEngine.ts`)
```typescript
// 1. Pitch Shift / Speed effect
if (this.enabledRandomEffects.pitch) {
  const pitchProb = (0.15 + (style / 100) * 0.75) * (intensity / 100);
  if (roll(pitchProb)) {
     // ... roll parameters and push to active list
  }
}
```

### Stable Round Registration (`src/utils/audioEngine.ts`)
```typescript
// Generate a stable, unique roundId and register it in roundBuffers so it is always play-backable
const roundId = Math.random().toString(36).substring(2, 9);
this.roundBuffers.set(roundId, { userBuffer: rawBuffer, processedBuffer });
```

---

## 📋 Comprehensive Checklist of Completed Verification

- [x] **Compile Applet**: Runs perfectly with zero build errors.
- [x] **Lint Applet**: Completed successfully with zero typescript errors.
- [x] **Dev Server**: Re-synchronized and serving on port `3000`.
- [x] **README.md**: Updated to include step-by-step guides for all features.
