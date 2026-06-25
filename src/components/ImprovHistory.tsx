import React, { useState, useRef } from 'react';
import { ImprovRound, AudioState } from '../types';
import { Play, Pause, Trash2, Clock, Music, Repeat, Mic, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ImprovHistoryProps {
  rounds: ImprovRound[];
  onClear: () => void;
  engine: any;
  audioState: AudioState;
}

export const ImprovHistory: React.FC<ImprovHistoryProps> = ({ rounds, onClear, engine, audioState }) => {
  const [playingRaw, setPlayingRaw] = useState<Record<string, boolean>>({});
  const [playingProcessed, setPlayingProcessed] = useState<Record<string, boolean>>({});
  const [loopingRounds, setLoopingRounds] = useState<Record<string, boolean>>({});
  const audioPlayersRef = useRef<Record<string, HTMLAudioElement>>({});

  const toggleLoop = (roundId: string) => {
    const isNowLooping = !loopingRounds[roundId];
    setLoopingRounds(prev => ({
      ...prev,
      [roundId]: isNowLooping
    }));

    if (audioState !== 'idle' && engine) {
      engine.setHistoryBufferLooping(roundId, isNowLooping);
    } else {
      const activeAudio = audioPlayersRef.current[roundId];
      if (activeAudio) {
        activeAudio.loop = isNowLooping;
      }
    }
  };

  const stopAllForRound = (roundId: string) => {
    if (audioState !== 'idle' && engine) {
      engine.stopHistoryBuffer(roundId);
    } else {
      const activeAudio = audioPlayersRef.current[roundId];
      if (activeAudio) {
        activeAudio.pause();
        delete audioPlayersRef.current[roundId];
      }
    }
    setPlayingRaw(prev => ({ ...prev, [roundId]: false }));
    setPlayingProcessed(prev => ({ ...prev, [roundId]: false }));
  };

  const handlePlayRaw = (roundId: string, url: string) => {
    const isCurrentlyPlayingRaw = !!playingRaw[roundId];
    const isLoopEnabled = !!loopingRounds[roundId];

    if (isCurrentlyPlayingRaw) {
      stopAllForRound(roundId);
    } else {
      // First stop any active sound for this round
      stopAllForRound(roundId);

      setPlayingRaw(prev => ({ ...prev, [roundId]: true }));

      if (audioState !== 'idle' && engine) {
        engine.playHistoryBuffer(roundId, 'raw', isLoopEnabled, () => {
          setPlayingRaw(prev => ({ ...prev, [roundId]: false }));
        });
      } else if (url) {
        const audio = new Audio(url);
        audio.loop = isLoopEnabled;
        audioPlayersRef.current[roundId] = audio;
        audio.play().catch(e => console.error('Audio playback failed', e));
        
        audio.onended = () => {
          setPlayingRaw(prev => ({ ...prev, [roundId]: false }));
          delete audioPlayersRef.current[roundId];
        };
      } else {
        alert("Audio source URL not available for this legacy round.");
        setPlayingRaw(prev => ({ ...prev, [roundId]: false }));
      }
    }
  };

  const handlePlayProcessed = (roundId: string) => {
    const isCurrentlyPlayingProcessed = !!playingProcessed[roundId];
    const isLoopEnabled = !!loopingRounds[roundId];

    if (isCurrentlyPlayingProcessed) {
      stopAllForRound(roundId);
    } else {
      // First stop any active sound for this round
      stopAllForRound(roundId);

      if (audioState === 'idle') {
        alert("Please click 'Start Session' first to activate the audio engine and listen to processed replication buffers!");
        return;
      }

      setPlayingProcessed(prev => ({ ...prev, [roundId]: true }));

      if (engine) {
        engine.playHistoryBuffer(roundId, 'processed', isLoopEnabled, () => {
          setPlayingProcessed(prev => ({ ...prev, [roundId]: false }));
        });
      }
    }
  };

  if (rounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-zinc-950 bg-white text-center rounded-none retro-shadow">
        <div className="h-10 w-10 bg-zinc-100 flex items-center justify-center text-zinc-950 mb-3 border border-zinc-950">
          <Music className="h-5 w-5" />
        </div>
        <h3 className="font-display font-black text-zinc-950 text-sm uppercase">No active recordings</h3>
        <p className="text-[10px] text-zinc-600 font-mono mt-1 max-w-[280px]">
          Press "Start Session" and make a sound into your microphone to populate this tape recorder log!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b-2 border-zinc-950 pb-2">
        <h3 className="font-display font-black text-zinc-950 tracking-tight flex items-center gap-2 text-base uppercase">
          <Music className="h-4.5 w-4.5" />
          SESSION LOG TAPE
        </h3>
        <button
          onClick={() => {
            // Pause any HTML5 players
            (Object.values(audioPlayersRef.current) as HTMLAudioElement[]).forEach(player => player.pause());
            audioPlayersRef.current = {};
            setPlayingRaw({});
            setPlayingProcessed({});
            onClear();
          }}
          className="text-xs font-mono font-black text-rose-700 hover:text-rose-800 hover:underline transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
          Purge Log
        </button>
      </div>

      <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
        {rounds.map((round, idx) => {
          const roundNum = rounds.length - idx;
          const isRawPlaying = !!playingRaw[round.id];
          const isProcessedPlaying = !!playingProcessed[round.id];
          const isLooping = !!loopingRounds[round.id];

          return (
            <motion.div
              key={round.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="flex flex-col gap-2.5 p-3.5 bg-white border-2 border-zinc-950 hover:bg-[#FAF6ED] transition-all relative rounded-none retro-shadow"
            >
              {/* Round header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-black bg-zinc-950 text-white px-2 py-0.5 border border-zinc-950 uppercase">
                    ROUND {roundNum}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {round.timestamp}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-black text-zinc-600">
                  Length: {round.durationSec}s
                </span>
              </div>

              {/* Effects list */}
              <div className="flex flex-wrap gap-1 mt-1">
                {round.effectsApplied.map((eff, eIdx) => (
                  <span
                    key={eIdx}
                    className="text-[9px] px-2 py-0.5 bg-zinc-100 border border-zinc-400 font-mono font-bold text-zinc-800 uppercase"
                  >
                    {eff}
                  </span>
                ))}
              </div>

              {/* Metadata & Controls Footer */}
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-dashed border-zinc-300">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
                  <span className="font-bold">Intensity: {round.intensity}%</span>
                </div>
                
                {/* 3 functional controls as explicitly requested */}
                <div className="grid grid-cols-3 gap-2">
                  {/* FUNCTIONAL 1: LOOP */}
                  <button
                    onClick={() => toggleLoop(round.id)}
                    title="Toggle Loop Layering"
                    className={`border-2 border-zinc-950 py-1.5 font-mono font-black text-[9px] uppercase transition-all cursor-pointer flex items-center justify-center gap-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-none translate-y-0 active:translate-y-[1px] ${
                      isLooping
                        ? 'bg-amber-400 text-zinc-950 shadow-none translate-y-[1px]'
                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <Repeat className={`h-3 w-3 ${isLooping ? 'animate-spin' : ''}`} />
                    <span>{isLooping ? 'Loop: ON' : 'Loop'}</span>
                  </button>

                  {/* FUNCTIONAL 2: PLAY OWN RECORDING */}
                  <button
                    onClick={() => handlePlayRaw(round.id, round.userAudioUrl || '')}
                    disabled={!round.userAudioUrl}
                    title="Play original user audio recording"
                    className={`border-2 border-zinc-950 py-1.5 font-mono font-black text-[9px] uppercase transition-all cursor-pointer flex items-center justify-center gap-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-none translate-y-0 active:translate-y-[1px] ${
                      isRawPlaying
                        ? 'bg-rose-500 text-white shadow-none translate-y-[1px]'
                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-950'
                    } ${!round.userAudioUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isRawPlaying ? (
                      <>
                        <Pause className="h-3 w-3 fill-current text-white" />
                        <span>Stop Own</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3 w-3" />
                        <span>Own Rec</span>
                      </>
                    )}
                  </button>

                  {/* FUNCTIONAL 3: PLAY PROCESSED REPLY */}
                  <button
                    onClick={() => handlePlayProcessed(round.id)}
                    title={audioState === 'idle' ? "Start session to activate playback of effects graph replica" : "Play reply replica sound"}
                    className={`border-2 border-zinc-950 py-1.5 font-mono font-black text-[9px] uppercase transition-all cursor-pointer flex items-center justify-center gap-1 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-none translate-y-0 active:translate-y-[1px] ${
                      isProcessedPlaying
                        ? 'bg-zinc-900 text-[#FAF6ED] shadow-none translate-y-[1px]'
                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-950'
                    } ${audioState === 'idle' ? 'opacity-65' : ''}`}
                  >
                    {isProcessedPlaying ? (
                      <>
                        <Pause className="h-3 w-3 fill-current text-rose-500" />
                        <span>Stop Rep</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3" />
                        <span>Reply</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
