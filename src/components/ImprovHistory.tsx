import React, { useState, useRef } from 'react';
import { ImprovRound } from '../types';
import { Play, Pause, Trash2, Calendar, Clock, Music, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface ImprovHistoryProps {
  rounds: ImprovRound[];
  onClear: () => void;
}

export const ImprovHistory: React.FC<ImprovHistoryProps> = ({ rounds, onClear }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayOriginal = (roundId: string, url: string) => {
    if (playingId === roundId) {
      // Pause
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingId(null);
    } else {
      // Play
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(e => console.error('Audio playback failed', e));
      setPlayingId(roundId);
      
      audio.onended = () => {
        setPlayingId(null);
      };
    }
  };

  if (rounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-zinc-400 bg-zinc-50 text-center rounded-lg">
        <div className="h-10 w-10 bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3 border border-zinc-300">
          <Music className="h-5 w-5" />
        </div>
        <h3 className="font-display font-bold text-zinc-950 text-sm uppercase">No active recordings</h3>
        <p className="text-xs text-zinc-600 font-mono mt-1 max-w-[280px]">
          Press "Start Session" and make a sound into your microphone to populate this tape recorder log!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
        <h3 className="font-display font-black text-zinc-950 tracking-tight flex items-center gap-2 text-base uppercase">
          <Music className="h-4.5 w-4.5 text-studio-accent" />
          SESSION LOG TAPE
        </h3>
        <button
          onClick={onClear}
          className="text-xs font-mono font-bold text-rose-600 hover:text-rose-700 hover:underline transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
          Purge Log
        </button>
      </div>

      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
        {rounds.map((round, idx) => (
          <motion.div
            key={round.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="flex flex-col gap-2.5 p-3.5 bg-zinc-50 border-2 border-zinc-950 hover:bg-white transition-all relative group"
          >
            {/* Round header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono font-black bg-zinc-950 text-white px-2 py-0.5 border border-zinc-950 uppercase">
                  ROUND {rounds.length - idx}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {round.timestamp}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-zinc-600">
                In: {round.durationSec}s
              </span>
            </div>

            {/* Effects list */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {round.effectsApplied.map((eff, eIdx) => (
                <span
                  key={eIdx}
                  className="text-xs px-2.5 py-1 bg-white border border-zinc-950 font-bold text-zinc-900 shadow-xs flex items-center gap-1"
                >
                  {eff}
                </span>
              ))}
            </div>

            {/* Intensity meter */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-zinc-300 text-[10px] font-mono text-zinc-600">
              <span className="font-bold">Intensity: {round.intensity}%</span>
              
              {/* Listen original user sound trigger */}
              {round.userAudioUrl && (
                <button
                  onClick={() => handlePlayOriginal(round.id, round.userAudioUrl!)}
                  className="bg-white hover:bg-zinc-100 text-zinc-950 font-bold flex items-center gap-1 border border-zinc-950 px-2 py-0.5 transition-all cursor-pointer shadow-xs"
                >
                  {playingId === round.id ? (
                    <>
                      <Pause className="h-2.5 w-2.5 fill-current text-rose-600" />
                      Pause Voice
                    </>
                  ) : (
                    <>
                      <Play className="h-2.5 w-2.5 fill-current text-zinc-950" />
                      Listen Voice
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
