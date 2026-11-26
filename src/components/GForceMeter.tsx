// G-Force Gauge and Telemetry Telemetry Display
import React from 'react';
import { SensorDataPoint } from '../types';
import { Compass, Zap } from 'lucide-react';

interface GForceMeterProps {
  currentPoint: SensorDataPoint | null;
  impactThreshold: number;
}

export const GForceMeter: React.FC<GForceMeterProps> = ({
  currentPoint,
  impactThreshold
}) => {
  const currentG = currentPoint?.magnitude ?? 1.0;
  const rotationRate = currentPoint?.rotationMagnitude ?? 0;
  const dynamicG = currentPoint?.dynamicAcceleration ?? 0;

  // Percentage for the gauge bar (0 to 6.0g max scale)
  const maxG = 6.0;
  const percentage = Math.min(100, Math.max(0, (currentG / maxG) * 100));
  const thresholdPercentage = (impactThreshold / maxG) * 100;

  // Color coding
  let statusColor = '#10b981'; // Green safe
  let statusText = 'SAFE';
  if (currentG >= impactThreshold) {
    statusColor = '#ef4444'; // Red impact
    statusText = 'CRASH SPIKE';
  } else if (currentG >= 2.2) {
    statusColor = '#f59e0b'; // Amber warning
    statusText = 'HIGH DECEL';
  } else if (currentG >= 1.4) {
    statusColor = '#06b6d4'; // Cyan active
    statusText = 'MODERATE';
  }

  return (
    <div className="gforce-meter-card">
      <div className="meter-top">
        <div className="meter-value-block">
          <span className="meter-label">Resultant G-Force</span>
          <div className="meter-digital-display">
            <span className="digital-number" style={{ color: statusColor }}>
              {currentG.toFixed(2)}
            </span>
            <span className="digital-unit">g</span>
          </div>
          <span className="meter-status-pill" style={{ borderColor: statusColor, color: statusColor }}>
            {statusText}
          </span>
        </div>

        <div className="meter-secondary-block">
          <div className="telemetry-mini-item">
            <span className="mini-label">
              <Zap size={12} className="inline mr-1 text-amber-400" />
              Dynamic Jerk
            </span>
            <span className="mini-val">{dynamicG.toFixed(2)}g</span>
          </div>
          <div className="telemetry-mini-item mt-2">
            <span className="mini-label">
              <Compass size={12} className="inline mr-1 text-cyan-400" />
              Gyro Tumbling
            </span>
            <span className="mini-val">{rotationRate.toFixed(0)}°/s</span>
          </div>
        </div>
      </div>

      {/* Visual Linear Gauge Bar with Threshold Marker */}
      <div className="meter-gauge-track">
        <div
          className="meter-gauge-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: statusColor,
            boxShadow: `0 0 12px ${statusColor}88`
          }}
        />
        <div
          className="meter-threshold-marker"
          style={{ left: `${thresholdPercentage}%` }}
          title={`Impact Threshold: ${impactThreshold}g`}
        >
          <span className="marker-label">{impactThreshold}g</span>
        </div>
      </div>

      <div className="meter-gauge-scale">
        <span>0g</span>
        <span>1.0g (Rest)</span>
        <span>2.0g</span>
        <span>3.5g</span>
        <span>5.0g+</span>
      </div>
    </div>
  );
};
