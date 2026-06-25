import React from 'react';
import { Sparkles, Mic, Volume2, Headphones, Activity } from 'lucide-react';

export const SoundImproHelp: React.FC = () => {
  return (
    <div className="bg-white border-2 border-zinc-950 rounded-xl p-5 shadow-sm flex flex-col gap-4 retro-shadow-sm">
      <h3 className="font-display font-black text-zinc-950 tracking-tight flex items-center gap-2 text-base uppercase">
        <Sparkles className="h-5 w-5 text-studio-accent" />
        Operational Manual
      </h3>

      <div className="grid grid-cols-1 gap-4">
        {/* Step 1 */}
        <div className="flex gap-3 items-start">
          <div className="h-8 w-8 min-w-[32px] bg-zinc-100 flex items-center justify-center text-zinc-950 border border-zinc-950 shadow-xs">
            <Mic className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="font-display font-bold text-zinc-950 text-sm">1. Speak or Play</h4>
            <p className="text-xs text-zinc-600 leading-relaxed font-mono">
              Press <strong>Start Session</strong> and make a sound! Sing, hum, whistle, clap, or play an instrument.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-3 items-start">
          <div className="h-8 w-8 min-w-[32px] bg-zinc-100 flex items-center justify-center text-zinc-950 border border-zinc-950 shadow-xs">
            <Activity className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="font-display font-bold text-zinc-950 text-sm">2. Silent Pause Trigger</h4>
            <p className="text-xs text-zinc-600 leading-relaxed font-mono">
              Once you stop making sound, our algorithm detects the quiet pause and immediately begins processing your audio!
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-3 items-start">
          <div className="h-8 w-8 min-w-[32px] bg-zinc-100 flex items-center justify-center text-zinc-950 border border-zinc-950 shadow-xs">
            <Volume2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="font-display font-bold text-zinc-950 text-sm">3. Sound Answer</h4>
            <p className="text-xs text-zinc-600 leading-relaxed font-mono">
              The app plays back an altered answer: your sound modified with pitch shifting, reverb, dub echo, vibrato, or ring modulation by chance!
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex gap-3 items-start">
          <div className="h-8 w-8 min-w-[32px] bg-zinc-100 flex items-center justify-center text-zinc-950 border border-zinc-950 shadow-xs">
            <Headphones className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="font-display font-bold text-zinc-950 text-sm">4. Continuous Loop</h4>
            <p className="text-xs text-zinc-600 leading-relaxed font-mono">
              After playback ends, the mic re-arms immediately. Join the conversation and improvise back and forth with the machine!
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#FAF6ED] rounded-lg p-3.5 border border-zinc-300 text-xs text-zinc-700 flex items-start gap-2.5 mt-1">
        <Headphones className="h-4 w-4 text-studio-accent shrink-0 mt-0.5" />
        <div className="font-mono text-[11px] leading-relaxed">
          <span className="font-bold text-zinc-950 block mb-0.5">Pro Performance Tips:</span>
          Use headphones to prevent the playback audio from triggering the mic again in a feedback loop. Find a quiet room and move the sliders to warp the answers!
        </div>
      </div>
    </div>
  );
};
