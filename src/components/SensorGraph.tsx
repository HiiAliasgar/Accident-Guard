// High-performance 50Hz Canvas Real-Time Sensor Waveform Oscilloscope
// OPTIMIZATIONS: Zero-GC Circular Ring Buffer, High-DPI Retina scaling, and RAF throttling
import React, { useEffect, useRef, useState } from 'react';
import { SensorDataPoint } from '../types';
import { Activity, Eye, EyeOff } from 'lucide-react';

interface SensorGraphProps {
  currentPoint: SensorDataPoint | null;
  historyLimit?: number;
}

export const SensorGraph: React.FC<SensorGraphProps> = ({
  currentPoint,
  historyLimit = 150 // ~3 seconds of 50Hz data
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // OPTIMIZATION: Fixed-capacity circular ring buffer with Float32Array arrays for ultra-fast zero-GC rendering
  const ringCap = historyLimit;
  const bufferHeadRef = useRef<number>(0);
  const bufferCountRef = useRef<number>(0);
  const xBuf = useRef<Float32Array>(new Float32Array(ringCap));
  const yBuf = useRef<Float32Array>(new Float32Array(ringCap));
  const zBuf = useRef<Float32Array>(new Float32Array(ringCap));
  const magBuf = useRef<Float32Array>(new Float32Array(ringCap));

  const animFrameIdRef = useRef<number | null>(null);

  // Channel toggles
  const [showX, setShowX] = useState(true);
  const [showY, setShowY] = useState(true);
  const [showZ, setShowZ] = useState(true);
  const [showMag, setShowMag] = useState(true);

  // Push new telemetry sample into typed ring buffers (O(1), zero allocation)
  useEffect(() => {
    if (currentPoint) {
      const idx = bufferHeadRef.current;
      xBuf.current[idx] = currentPoint.x;
      yBuf.current[idx] = currentPoint.y;
      zBuf.current[idx] = currentPoint.z;
      magBuf.current[idx] = currentPoint.magnitude;

      bufferHeadRef.current = (idx + 1) % ringCap;
      if (bufferCountRef.current < ringCap) {
        bufferCountRef.current++;
      }
    }
  }, [currentPoint, ringCap]);

  // High-DPI Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI Retina scaling
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = 640;
    const logicalHeight = 220;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      const width = logicalWidth;
      const height = logicalHeight;
      const count = bufferCountRef.current;
      const head = bufferHeadRef.current;

      // Clear canvas with dark slate background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Draw horizontal grid lines & labels (-4g, -2g, 0g, +2g, +4g)
      const centerY = height / 2;
      const gScale = height / 10; // ±5g full scale

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;

      for (let g = -4; g <= 4; g += 2) {
        const y = centerY - g * gScale;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${g > 0 ? '+' : ''}${g}g`, 8, y - 3);
      }

      // 0g baseline (neutral axis)
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // +3.5g impact threshold warning line
      const thresholdY = centerY - 3.5 * gScale;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(width, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]); // reset line dash

      ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('CRASH THRESHOLD (+3.5g)', width - 145, thresholdY - 4);

      if (count < 2) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      const stepX = width / (ringCap - 1);
      const startIndex = ringCap - count;

      // Helper to draw a single channel wave directly from typed ring buffer
      const drawChannel = (typedBuf: Float32Array, color: string, lineWidth: number = 1.8) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();

        for (let i = 0; i < count; i++) {
          // Circular index calculation: oldest to newest
          const ringIdx = (head - count + i + ringCap) % ringCap;
          const x = (startIndex + i) * stepX;
          const val = typedBuf[ringIdx];
          const y = centerY - val * gScale;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      };

      // Draw active channels
      if (showX) drawChannel(xBuf.current, '#10b981', 1.5); // Emerald X
      if (showY) drawChannel(yBuf.current, '#06b6d4', 1.5); // Cyan Y
      if (showZ) drawChannel(zBuf.current, '#a855f7', 1.5); // Purple Z
      if (showMag) drawChannel(magBuf.current, '#f59e0b', 2.5); // Amber Resultant Magnitude

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [showX, showY, showZ, showMag, ringCap]);

  return (
    <div className="sensor-graph-container">
      <div className="sensor-graph-header">
        <div className="sensor-graph-title">
          <Activity size={16} className="text-cyan-400" />
          <span>Real-time Waveform (~50Hz Ring Buffer)</span>
        </div>
        <div className="channel-toggles">
          <button
            type="button"
            className={`channel-pill ${showMag ? 'active mag' : ''}`}
            onClick={() => setShowMag(!showMag)}
          >
            {showMag ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>|a| {currentPoint?.magnitude.toFixed(2) ?? '0.00'}g</span>
          </button>
          <button
            type="button"
            className={`channel-pill ${showX ? 'active x' : ''}`}
            onClick={() => setShowX(!showX)}
          >
            <span>X {currentPoint?.x.toFixed(1) ?? '0.0'}</span>
          </button>
          <button
            type="button"
            className={`channel-pill ${showY ? 'active y' : ''}`}
            onClick={() => setShowY(!showY)}
          >
            <span>Y {currentPoint?.y.toFixed(1) ?? '0.0'}</span>
          </button>
          <button
            type="button"
            className={`channel-pill ${showZ ? 'active z' : ''}`}
            onClick={() => setShowZ(!showZ)}
          >
            <span>Z {currentPoint?.z.toFixed(1) ?? '1.0'}</span>
          </button>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '180px' }}
          className="waveform-canvas"
        />
      </div>

      <div className="graph-footer">
        <span className="footer-legend">
          <span className="legend-dot bg-amber"></span> Mag ||a||
          <span className="legend-dot bg-emerald ml-3"></span> Accel X
          <span className="legend-dot bg-cyan ml-3"></span> Accel Y
          <span className="legend-dot bg-purple ml-3"></span> Accel Z
        </span>
        <span className="footer-gyro">
          Gyro: {currentPoint?.rotationMagnitude.toFixed(0) ?? '0'}°/s
        </span>
      </div>
    </div>
  );
};
