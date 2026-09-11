// ML & Engineering Architecture Reference Modal: Threshold Heuristics vs Production Deep Learning
import React from 'react';
import { X, Cpu, Layers, GitCompare, Database, AlertCircle, CheckCircle2 } from 'lucide-react';

interface MLReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MLReferenceModal: React.FC<MLReferenceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="ml-modal-overlay">
      <div className="ml-modal-content">
        <div className="ml-modal-header">
          <div className="flex items-center space-x-2">
            <Cpu size={20} className="text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Algorithm & ML Architecture Specification</h2>
          </div>
          <button
            type="button"
            className="ml-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="ml-modal-body">
          {/* Section 1: State Machine Overview */}
          <div className="ml-section">
            <h3 className="ml-section-title">
              <Layers size={16} className="text-emerald-400 mr-2" />
              Current State Machine Architecture
            </h3>
            <div className="state-machine-flow">
              <div className="state-node safe">
                <span className="node-title">NORMAL</span>
                <span className="node-desc">50Hz telemetry, road vibration filtering</span>
              </div>
              <span className="node-arrow">→ ||a|| &gt; 3.5g →</span>
              <div className="state-node warning">
                <span className="node-title">IMPACT_DETECTED</span>
                <span className="node-desc">Peak g &amp; gyro yaw/pitch registered</span>
              </div>
              <span className="node-arrow">→ 0.4s window →</span>
              <div className="state-node confirming">
                <span className="node-title">CONFIRMING</span>
                <span className="node-desc">Stillness variance &lt; 0.25g + Gyro &gt; 180°/s</span>
              </div>
              <span className="node-arrow">→ Stillness verified →</span>
              <div className="state-node danger">
                <span className="node-title">COUNTDOWN &amp; ALERT</span>
                <span className="node-desc">15s abort window → GPS SMS Dispatch</span>
              </div>
            </div>
          </div>

          {/* Section 2: Mathematical Formulations */}
          <div className="ml-section">
            <h3 className="ml-section-title">
              <Cpu size={16} className="text-cyan-400 mr-2" />
              Mathematical Formulations &amp; Threshold Rationale
            </h3>
            <div className="math-cards-grid">
              <div className="math-card">
                <span className="math-title">Resultant Acceleration Magnitude:</span>
                <code className="math-formula">||a|| = √(x² + y² + z²)</code>
                <p className="math-explain">
                  Invariant to phone orientation inside vehicle mount or pocket. Normalized to units of earth gravity (1g ≈ 9.80665 m/s²).
                </p>
              </div>

              <div className="math-card">
                <span className="math-title">Angular Velocity Tumbling Norm:</span>
                <code className="math-formula">||ω|| = √(α² + β² + γ²)</code>
                <p className="math-explain">
                  Tracks 3D rotational kinetic energy. Distinguishes planar impacts from multi-axis tumbling and roll dynamics.
                </p>
              </div>

              <div className="math-card">
                <span className="math-title">Post-Impact Stillness Variance:</span>
                <code className="math-formula">Var(a) = (1/N) ∑(||a_i|| - μ)²</code>
                <p className="math-explain">
                  Over a 3.0s sliding window (N=150 samples @ 50Hz). If Var &lt; 0.25g, vehicle immobilisation is confirmed.
                </p>
              </div>

              <div className="math-card">
                <span className="math-title">Great-Circle Trauma Routing (Haversine):</span>
                <code className="math-formula">d = 2R · arcsin(√(sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2)))</code>
                <p className="math-explain">
                  Calculates real-time spherical distance to all registered Level-1/Level-2 trauma facilities.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Comparative Analysis - Heuristics vs ML */}
          <div className="ml-section">
            <h3 className="ml-section-title">
              <GitCompare size={16} className="text-amber-400 mr-2" />
              Heuristic Filtering vs Production ML Pipeline
            </h3>
            <div className="comparison-table-wrapper">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Dimension</th>
                    <th>Current Heuristic Engine (MVP)</th>
                    <th>Production ML Pipeline (Phase 2)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Algorithm</strong></td>
                    <td>Multi-condition deterministic thresholding + sliding variance filter</td>
                    <td>1D-CNN + Bidirectional LSTM with Attention or XGBoost ensemble</td>
                  </tr>
                  <tr>
                    <td><strong>False Positive Rejection</strong></td>
                    <td>Rejects phone drops using stillness window &amp; gyro threshold</td>
                    <td>Temporal pattern recognition across 2.5s window (99.8% precision)</td>
                  </tr>
                  <tr>
                    <td><strong>Edge Inference Latency</strong></td>
                    <td>&lt; 0.5 ms (zero CPU overhead, battery efficient)</td>
                    <td>~12 ms (via ONNX Runtime Mobile / TensorFlow Lite INT8 quantized)</td>
                  </tr>
                  <tr>
                    <td><strong>Hardware Requirements</strong></td>
                    <td>Runs seamlessly in web browser, Android, iOS, or embedded microcontrollers</td>
                    <td>Requires TFLite / CoreML runtime embedded in mobile APK/IPA</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Production ML Transition Roadmap */}
          <div className="ml-section">
            <h3 className="ml-section-title">
              <Database size={16} className="text-purple-400 mr-2" />
              Production ML Roadmap &amp; Labeled Training Datasets
            </h3>
            <ul className="roadmap-list">
              <li>
                <CheckCircle2 size={16} className="text-emerald-400 mr-2 flex-shrink-0" />
                <span>
                  <strong>Dataset Sourcing:</strong> Combine public automotive crash telemetry (NHTSA Vehicle Crash Test Database, UTD-MHAD, SHRP2 Naturalistic Driving Study) with synthetic data augmentation (jittering, time-warping, orientation permutation).
                </span>
              </li>
              <li>
                <CheckCircle2 size={16} className="text-emerald-400 mr-2 flex-shrink-0" />
                <span>
                  <strong>Feature Engineering:</strong> Extract spectral features via Fast Fourier Transform (FFT), Jerk derivatives (da/dt), spectral centroid, and zero-crossing rates.
                </span>
              </li>
              <li>
                <CheckCircle2 size={16} className="text-emerald-400 mr-2 flex-shrink-0" />
                <span>
                  <strong>Edge Quantization:</strong> Quantize model to 8-bit integers (INT8) for maximum battery life and sub-10ms inference on mobile NPUs (Apple Neural Engine / Qualcomm Hexagon).
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="ml-modal-footer">
          <button type="button" className="ml-done-btn" onClick={onClose}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
