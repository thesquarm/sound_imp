import React, { useEffect, useRef } from 'react';

interface WaveVisualizerProps {
  dataArray: Uint8Array;
  rms: number;
  isInput: boolean;
  isActive: boolean;
  state: 'idle' | 'initializing' | 'waiting_for_sound' | 'recording_sound' | 'processing' | 'playing_answer';
  transparentBg?: boolean;
}

export const WaveVisualizer: React.FC<WaveVisualizerProps> = ({
  dataArray,
  rms,
  isInput,
  isActive,
  state,
  transparentBg = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const POINTS = 128;
  const smoothedPointsRef = useRef<number[]>(new Array(POINTS).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      // 1. Clear background with high-end dark slate/parchment background matching the theme
      ctx.clearRect(0, 0, width, height);

      // Draw horizontal reference line
      ctx.strokeStyle = transparentBg ? 'rgba(24, 24, 27, 0.15)' : 'rgba(232, 230, 224, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (!isActive || dataArray.length === 0) {
        // Render a gentle static breathing wave if idle
        ctx.beginPath();
        ctx.strokeStyle = transparentBg ? 'rgba(24, 24, 27, 0.35)' : '#E8E6E0';
        ctx.lineWidth = 1.5;
        const time = Date.now() * 0.003;
        for (let i = 0; i < width; i++) {
          const x = i;
          const y = height / 2 + Math.sin(i * 0.03 + time) * (state === 'waiting_for_sound' ? 4 : 1);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      // 2. Determine color scheme based on state
      let strokeColor = '#E55B3C'; // Coral (Recording/Mic)
      let glowColor = 'rgba(229, 91, 60, 0.3)';

      if (!isInput) {
        strokeColor = '#0EA5E9'; // Sky blue (Playback)
        glowColor = 'rgba(14, 165, 233, 0.3)';
      } else if (state === 'waiting_for_sound') {
        strokeColor = transparentBg ? '#18181b' : '#94A3B8'; // Slate grey or zinc-900
        glowColor = transparentBg ? 'rgba(24, 24, 27, 0.2)' : 'rgba(148, 163, 184, 0.2)';
      }

      // 3. Render waveform line
      ctx.shadowBlur = rms > 0.02 ? 10 : 0;
      ctx.shadowColor = strokeColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = state === 'recording_sound' ? 2.5 : 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Downsample and exponentially smooth waveform data
      const windowSize = Math.floor(dataArray.length / POINTS);
      for (let k = 0; k < POINTS; k++) {
        let sum = 0;
        const startIdx = k * windowSize;
        const endIdx = Math.min(dataArray.length, (k + 1) * windowSize);
        const count = endIdx - startIdx;
        
        for (let j = startIdx; j < endIdx; j++) {
          sum += dataArray[j] / 128.0 - 1.0; // range -1.0 to 1.0
        }
        
        const targetVal = count > 0 ? sum / count : 0;
        // Calm smoothing factor (0.75 makes it beautifully slow and smooth)
        const smoothFactor = 0.75;
        smoothedPointsRef.current[k] = smoothedPointsRef.current[k] * smoothFactor + targetVal * (1 - smoothFactor);
      }

      ctx.beginPath();
      const sliceWidth = width / POINTS;
      let x = 0;

      for (let i = 0; i < POINTS; i++) {
        // Boost signal dynamically but cap it to avoid extreme screen-clipping lines
        const boost = rms > 0 ? Math.max(1.0, Math.min(3.5, 0.15 / (rms + 0.005))) : 1.0;
        const offset = smoothedPointsRef.current[i] * boost * (height / 2.3);
        const y = height / 2 + offset;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // 4. Draw additional dynamic bento-like details (RMS ring/level meter at side)
      if (rms > 0.005) {
        const meterHeight = Math.min(height - 10, rms * height * 1.5);
        ctx.fillStyle = glowColor;
        ctx.fillRect(width - 8, height - meterHeight - 5, 4, meterHeight);
        ctx.fillStyle = strokeColor;
        ctx.fillRect(width - 8, height - 10, 4, 4);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dataArray, rms, isInput, isActive, state, transparentBg]);

  if (transparentBg) {
    return (
      <div className="w-full h-full relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[140px] bg-slate-900/5 dark:bg-slate-900/20 rounded-xl overflow-hidden border border-studio-border/50">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* State Badge Overlay */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <span className="flex h-2 w-2 relative">
          {isActive && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isInput ? 'bg-studio-accent' : 'bg-sky-500'
            }`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${
            !isActive ? 'bg-studio-muted' : isInput ? 'bg-studio-accent' : 'bg-sky-500'
          }`}></span>
        </span>
        <span className="text-[10px] font-mono tracking-widest uppercase text-studio-text/60">
          {state === 'waiting_for_sound' ? 'MICROPHONE ACTIVE' : state === 'recording_sound' ? 'RECORDING' : state === 'playing_answer' ? 'RESPONSE PLAYBACK' : 'OSCILLOSCOPE'}
        </span>
      </div>

      {/* Signal Level Indicator */}
      <div className="absolute bottom-3 right-3 text-[10px] font-mono text-studio-text/50 pointer-events-none">
        RMS: {rms.toFixed(4)}
      </div>
    </div>
  );
};
