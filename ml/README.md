# AccidentGuard ML pipeline

## Status
This is a training scaffold, not a trained or deployed crash classifier. No labeled dataset has been validated or included in this repository, so no accuracy, recall, false-positive rate, or safety claim is made. The app currently uses an experimental rule-based heuristic only.

## Dataset contract
Supply a CSV file with one sensor sample per row and the columns:
- `session_id`: trip/session identifier. All windows from the same session must remain in one split.
- `timestamp_ms`: monotonic sample timestamp in milliseconds.
- `accel_x_g`, `accel_y_g`, `accel_z_g`: acceleration axes in g, with orientation/convention documented.
- `gyro_x_dps`, `gyro_y_dps`, `gyro_z_dps`: angular velocity axes in degrees/second.
- `label`: `normal` or `crash`; labels must be aligned to real annotated events.
Optional `subject_id` can be used to keep subjects separated across train/test. Do not create synthetic rows and then report their performance as real-world evidence.

## Run
```bash
python -m venv .venv
# activate the environment for your OS
pip install -r ml/requirements.txt
python ml/train.py --input path/to/labeled-samples.csv --output ml/artifacts
```

The script builds fixed, non-overlapping windows within each session and performs group-aware train/validation/test partitioning by subject (when available) or session. It trains a Random Forest baseline and saves a model, feature schema, metrics, and confusion matrix. Inspect group counts and class counts before accepting output. If a split lacks both classes, training exits rather than producing misleading metrics.

## Limitations before app integration
- This script's model is not yet called by the React/Capacitor app.
- A labeled dataset containing real crash and non-crash driving sessions is required.
- Validation should include potholes, speed bumps, phone drops, hard braking, rough roads, and varied mounting positions.
- Evaluate missed events, precision/recall/F1, false positives per driving hour, time-to-detection, device inference latency, and subgroup performance. Do not report these metrics unless the data and implementation support them.
- Deployment requires a separately tested model format/runtime and a versioned input normalization contract.
- This is research/prototype tooling, not a certified safety system.
