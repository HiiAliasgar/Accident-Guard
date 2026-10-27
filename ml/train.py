#!/usr/bin/env python3
"""Train an experimental crash-window baseline from a validated labeled CSV.

No dataset is bundled. Outputs are research artifacts, not safety certification.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GroupShuffleSplit

FEATURE_COLUMNS = [
    "accel_x_g",
    "accel_y_g",
    "accel_z_g",
    "gyro_x_dps",
    "gyro_y_dps",
    "gyro_z_dps",
]
REQUIRED_COLUMNS = {"session_id", "timestamp_ms", "label", *FEATURE_COLUMNS}
LABEL_MAP = {"normal": 0, "crash": 1}


def load_data(csv_path: Path) -> pd.DataFrame:
    frame = pd.read_csv(csv_path)
    missing = sorted(REQUIRED_COLUMNS - set(frame.columns))
    if missing:
        raise ValueError(f"CSV is missing required columns: {', '.join(missing)}")
    if frame.empty:
        raise ValueError("CSV contains no samples.")
    frame["session_id"] = frame["session_id"].astype(str)
    frame["label"] = frame["label"].astype(str).str.strip().str.lower()
    unknown = sorted(set(frame["label"]) - set(LABEL_MAP))
    if unknown:
        raise ValueError(f"Unsupported labels: {unknown}; expected normal/crash.")
    frame["timestamp_ms"] = pd.to_numeric(frame["timestamp_ms"], errors="coerce")
    for col in FEATURE_COLUMNS:
        frame[col] = pd.to_numeric(frame[col], errors="coerce")
    if frame[["timestamp_ms", *FEATURE_COLUMNS]].isna().any().any():
        raise ValueError("Timestamp/features contain missing or non-numeric values.")
    if not np.isfinite(frame[["timestamp_ms", *FEATURE_COLUMNS]].to_numpy(dtype=float)).all():
        raise ValueError("Timestamp/features contain infinite values.")
    if (frame["session_id"].str.len() == 0).any():
        raise ValueError("session_id cannot be empty.")
    frame = frame.sort_values(["session_id", "timestamp_ms"]).reset_index(drop=True)
    if frame.duplicated(["session_id", "timestamp_ms"]).any():
        raise ValueError("Duplicate timestamp within a session; resolve sampling duplicates.")
    return frame


def make_windows(frame: pd.DataFrame, window_samples: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    features: list[list[float]] = []
    labels: list[int] = []
    groups: list[str] = []
    has_subjects = "subject_id" in frame.columns and frame["subject_id"].notna().all()
    grouping_column = "subject_id" if has_subjects else "session_id"
    grouping_by_session = frame.groupby("session_id", sort=False)
    for session_id, session in grouping_by_session:
        group_value = str(session[grouping_column].iloc[0])
        values = session[FEATURE_COLUMNS].to_numpy(dtype=float)
        target = session["label"].map(LABEL_MAP).to_numpy(dtype=int)
        # Only full, non-overlapping windows, never crossing session boundaries.
        for start in range(0, len(session) - window_samples + 1, window_samples):
            stop = start + window_samples
            block = values[start:stop]
            block_labels = target[start:stop]
            # A window is positive if any sample is in an annotated crash window.
            # Dataset authors must define this labeling policy and event boundaries.
            magnitude = np.sqrt(np.sum(block[:, :3] ** 2, axis=1))
            gyro_magnitude = np.sqrt(np.sum(block[:, 3:] ** 2, axis=1))
            features.append([
                float(np.mean(magnitude)),
                float(np.std(magnitude)),
                float(np.max(magnitude)),
                float(np.min(magnitude)),
                float(np.mean(gyro_magnitude)),
                float(np.std(gyro_magnitude)),
                float(np.max(gyro_magnitude)),
                float(np.mean(np.abs(np.diff(magnitude)))) if len(magnitude) > 1 else 0.0,
                float(np.mean(block[:, 0])),
                float(np.std(block[:, 0])),
                float(np.mean(block[:, 1])),
                float(np.std(block[:, 1])),
                float(np.mean(block[:, 2])),
                float(np.std(block[:, 2])),
            ])
            labels.append(int(np.any(block_labels == 1)))
            groups.append(group_value)
    if not features:
        raise ValueError(f"No windows formed: each session needs at least {window_samples} samples.")
    return np.asarray(features), np.asarray(labels), np.asarray(groups)


def group_split(groups: np.ndarray, labels: np.ndarray, seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Create approximate 70/15/15 splits without splitting sessions across sets."""
    unique_groups = np.unique(groups)
    if len(unique_groups) < 5:
        raise ValueError("At least 5 distinct sessions are required for a coarse group-aware split.")
    first = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=seed)
    train_idx, hold_idx = next(first.split(np.zeros(len(groups)), labels, groups))
    hold_groups = groups[hold_idx]
    second = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=seed + 1)
    val_rel, test_rel = next(second.split(np.zeros(len(hold_idx)), labels[hold_idx], hold_groups))
    val_idx, test_idx = hold_idx[val_rel], hold_idx[test_rel]
    for name, idx in (("train", train_idx), ("validation", val_idx), ("test", test_idx)):
        if len(np.unique(labels[idx])) < 2:
            raise ValueError(
                f"{name} split does not contain both classes. Add varied, independently labeled sessions; "
                "do not switch to random window splitting because that leaks session patterns."
            )
    return train_idx, val_idx, test_idx


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="CSV of labeled sensor samples")
    parser.add_argument("--output", required=True, type=Path, help="Directory for model and evaluation artifacts")
    parser.add_argument("--window-samples", type=int, default=50, help="Samples per window (default: 50)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if args.window_samples < 5:
        parser.error("--window-samples must be at least 5")

    data = load_data(args.input)
    x, y, groups = make_windows(data, args.window_samples)
    train_idx, val_idx, test_idx = group_split(groups, y, args.seed)

    # Validation is reported separately; test set is used only for final evaluation below.
    model = RandomForestClassifier(
        n_estimators=300,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=args.seed,
        n_jobs=-1,
    )
    model.fit(x[train_idx], y[train_idx])
    validation_predictions = model.predict(x[val_idx])
    test_predictions = model.predict(x[test_idx])

    def metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
        return {
            "precision_crash": float(precision_score(y_true, y_pred, zero_division=0)),
            "recall_crash": float(recall_score(y_true, y_pred, zero_division=0)),
            "f1_crash": float(f1_score(y_true, y_pred, zero_division=0)),
            "confusion_matrix_labels_normal_crash": confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist(),
            "classification_report": classification_report(
                y_true, y_pred, labels=[0, 1], target_names=["normal", "crash"], zero_division=0, output_dict=True
            ),
        }

    args.output.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, args.output / "crash_window_random_forest.joblib")
    report = {
        "status": "experimental_unvalidated_research_baseline",
        "dataset": str(args.input),
        "sample_rows": int(len(data)),
        "session_count": int(data["session_id"].nunique()),
        "split_grouping": "subject_id" if "subject_id" in data.columns and data["subject_id"].notna().all() else "session_id",
        "window_samples": int(args.window_samples),
        "window_count": int(len(y)),
        "window_label_counts": {"normal": int(np.sum(y == 0)), "crash": int(np.sum(y == 1))},
        "split_session_counts": {
            "train": int(len(np.unique(groups[train_idx]))),
            "validation": int(len(np.unique(groups[val_idx]))),
            "test": int(len(np.unique(groups[test_idx]))),
        },
        "validation": metrics(y[val_idx], validation_predictions),
        "test": metrics(y[test_idx], test_predictions),
        "feature_schema": [
            "mean_accel_magnitude_g", "std_accel_magnitude_g", "max_accel_magnitude_g",
            "min_accel_magnitude_g", "mean_gyro_magnitude_dps", "std_gyro_magnitude_dps",
            "max_gyro_magnitude_dps", "mean_abs_accel_magnitude_delta_g",
            "mean_accel_x_g", "std_accel_x_g", "mean_accel_y_g", "std_accel_y_g",
            "mean_accel_z_g", "std_accel_z_g",
        ],
        "limitations": [
            "No bundled dataset; metrics describe only the supplied CSV.",
            "Splits are subject-aware when a non-missing subject_id column is supplied; otherwise session-aware. Data collection must ensure session IDs represent distinct trips and subjects.",
            "False positives per driving hour and event detection latency are not computed by this window classifier.",
            "Not integrated into the app and not safety-validated.",
        ],
    }
    (args.output / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "validation_f1_crash": report["validation"]["f1_crash"],
        "test_f1_crash": report["test"]["f1_crash"],
        "status": report["status"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
