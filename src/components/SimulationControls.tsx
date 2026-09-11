// Interactive Crash Simulation Testbench Controls
import React from 'react';
import { SimulationScenario } from '../types';
import { Play, RotateCcw, AlertTriangle, ShieldCheck, Flame, Smartphone, Car } from 'lucide-react';

interface SimulationControlsProps {
  currentScenario: SimulationScenario;
  onTriggerScenario: (scenario: SimulationScenario) => void;
  onTriggerManualEmergency: () => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  currentScenario,
  onTriggerScenario,
  onTriggerManualEmergency
}) => {
  return (
    <div className="sim-controls-card">
      <div className="sim-controls-header">
        <div className="flex items-center space-x-2">
          <Flame size={16} className="text-amber-400" />
          <span className="sim-title">Crash Simulation Testbench</span>
        </div>
        <span className="sim-pill">Testing Sandbox</span>
      </div>

      <p className="sim-description">
        Since real collisions cannot be physically induced, test the algorithm's multi-stage state machine using calibrated dynamics:
      </p>

      <div className="sim-buttons-grid">
        {/* Scenario 1: Severe Frontal Impact */}
        <button
          type="button"
          className={`sim-btn danger ${currentScenario === 'HEAD_ON_COLLISION' ? 'active' : ''}`}
          onClick={() => onTriggerScenario('HEAD_ON_COLLISION')}
          id="btn-sim-head-on"
        >
          <div className="btn-icon-wrap bg-red-900/40 text-red-400">
            <Flame size={16} />
          </div>
          <div className="btn-text-wrap">
            <span className="btn-title">Severe Frontal Crash</span>
            <span className="btn-meta">4.8g deceleration spike → vehicle stops</span>
          </div>
        </button>

        {/* Scenario 2: Rollover */}
        <button
          type="button"
          className={`sim-btn danger ${currentScenario === 'ROLLOVER_CRASH' ? 'active' : ''}`}
          onClick={() => onTriggerScenario('ROLLOVER_CRASH')}
          id="btn-sim-rollover"
        >
          <div className="btn-icon-wrap bg-orange-900/40 text-orange-400">
            <RotateCcw size={16} />
          </div>
          <div className="btn-text-wrap">
            <span className="btn-title">Vehicle Rollover</span>
            <span className="btn-meta">3.8g shock + violent 420°/s gyro tumble</span>
          </div>
        </button>

        {/* Scenario 3: Phone Drop (False Alarm Rejection Test) */}
        <button
          type="button"
          className={`sim-btn warning ${currentScenario === 'PHONE_DROP_REJECTION' ? 'active' : ''}`}
          onClick={() => onTriggerScenario('PHONE_DROP_REJECTION')}
          id="btn-sim-drop"
        >
          <div className="btn-icon-wrap bg-amber-900/40 text-amber-400">
            <Smartphone size={16} />
          </div>
          <div className="btn-text-wrap">
            <span className="btn-title">Phone Drop (Rejection Test)</span>
            <span className="btn-meta">4.1g drop shock → motion continues (Dismissed)</span>
          </div>
        </button>

        {/* Scenario 4: Speed Bump / Pothole */}
        <button
          type="button"
          className={`sim-btn safe ${currentScenario === 'SPEED_BUMP_POTHOLE' ? 'active' : ''}`}
          onClick={() => onTriggerScenario('SPEED_BUMP_POTHOLE')}
          id="btn-sim-bump"
        >
          <div className="btn-icon-wrap bg-cyan-900/40 text-cyan-400">
            <Car size={16} />
          </div>
          <div className="btn-text-wrap">
            <span className="btn-title">Pothole / Speed Bump</span>
            <span className="btn-meta">1.8g impulse (Below 3.5g threshold → Safe)</span>
          </div>
        </button>
      </div>

      {/* Direct Instant Countdown Trigger */}
      <div className="sim-direct-trigger mt-3">
        <button
          type="button"
          className="direct-crash-btn"
          onClick={onTriggerManualEmergency}
          id="btn-manual-emergency"
        >
          <AlertTriangle size={16} className="mr-2 text-red-300" />
          <span>Instant Emergency Countdown Trigger (Skip Sensor Delay)</span>
        </button>
      </div>
    </div>
  );
};
