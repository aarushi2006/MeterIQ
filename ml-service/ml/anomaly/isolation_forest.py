"""
UC1 Isolation Forest anomaly detector.

Training strategy (Part 4): PER-METER chronological split - approach A
("train on an earlier chronological portion, score a later portion"),
applied independently for each meter rather than one global model.

Why per-meter rather than one fleet-wide model: Part 5's investigation
(see backend/README.md) confirmed consumption scale varies drastically
across the 84 meters (per-meter row counts alone range 56K-389K; raw
consumption values are similarly spread). A single global model would
need meter identity or per-meter scale encoded as a feature to compensate
- a separate model per meter sidesteps that entirely, since each model
only ever sees one meter's own scale. The cost is more models to manage
(84 instead of 1) and less data per model, which is exactly why
min_observations_per_meter exists: below that threshold, a meter's
Isolation Forest is skipped and the statistical baseline (baseline.py)
is used alone for that meter instead of a model trained on too little
history to be reliable.

Leakage prevention: for each meter, its own rows are sorted by timestamp,
the first `train_fraction` become the training set, and the model is
scored ONLY on the remaining, strictly-later rows. No row is ever scored
using a model that was trained on rows at or after its own timestamp.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from ..config import config
from ..logging_config import get_logger

logger = get_logger("anomaly.isolation_forest")


def chronological_split(meter_df, train_fraction=None):
    """
    meter_df must already be sorted by timestamp (single meter's data).
    Returns (train_df, score_df) with train strictly before score in time.
    """
    train_fraction = config.anomaly_train_fraction if train_fraction is None else train_fraction
    n = len(meter_df)
    split_idx = int(n * train_fraction)
    return meter_df.iloc[:split_idx], meter_df.iloc[split_idx:]


def _prepare_feature_matrix(df, feature_cols):
    """
    Drops rows with any NaN in the selected features (Isolation Forest
    can't accept NaN) and returns (clean_df, feature_matrix). Logs how
    many rows were dropped so this is visible, not silent.
    """
    available_cols = [c for c in feature_cols if c in df.columns]
    missing_cols = [c for c in feature_cols if c not in df.columns]
    if missing_cols:
        logger.warning(f"Requested anomaly features not present in data, skipping: {missing_cols}")

    mask = df[available_cols].notna().all(axis=1)
    clean = df[mask]
    dropped = len(df) - len(clean)
    if dropped:
        logger.info(f"Dropped {dropped:,}/{len(df):,} rows with NaN in feature columns before Isolation Forest")

    return clean, clean[available_cols].to_numpy(dtype='float64')


def fit_and_score_meter(meter_df, feature_cols=None, train_fraction=None):
    """
    Fits one Isolation Forest on the training portion of a single meter's
    data and scores the held-out later portion.

    Returns a DataFrame indexed like the scored (later) portion, with an
    added `isolation_forest_severity` column (0-100, higher = more
    anomalous), or None if the meter has fewer than
    config.min_observations_per_meter usable training rows (Part 5
    fallback - the caller should use the statistical baseline alone in
    that case).

    Reproducibility: uses config.random_seed, the same seed the rest of
    the pipeline uses - not a separate UC1-only seed.
    """
    feature_cols = feature_cols or config.anomaly_features

    meter_df = meter_df.sort_values('timestamp')
    train_df, score_df = chronological_split(meter_df, train_fraction)

    train_clean, train_X = _prepare_feature_matrix(train_df, feature_cols)
    if len(train_clean) < config.min_observations_per_meter:
        logger.info(
            f"Meter has only {len(train_clean)} usable training rows "
            f"(< min_observations_per_meter={config.min_observations_per_meter}) - "
            "skipping Isolation Forest, baseline-only for this meter."
        )
        return None

    score_clean, score_X = _prepare_feature_matrix(score_df, feature_cols)
    if len(score_clean) == 0:
        return None

    model = IsolationForest(
        n_estimators=config.isolation_forest_n_estimators,
        contamination=config.isolation_forest_contamination,
        random_state=config.random_seed,
        n_jobs=1,  # per-meter models are already small; parallelizing across meters (in pipeline.py) is more effective than within one fit
    )
    model.fit(train_X)

    # --- Severity calibration ---
    #
    # PREVIOUS APPROACH (removed - was wrong, and its own comment claimed
    # the opposite of what it did): min-max scaled the raw decision score
    # WITHIN each meter's scoring window, so every meter's own minimum
    # became ~0 and its own maximum became ~100 regardless of how
    # anomalous that meter's most extreme point actually was. A meter
    # whose "worst" scoring-window point was genuinely mild still got
    # severity=100 for it - the exact opposite of "comparable across
    # meters" the old comment claimed.
    #
    # CURRENT APPROACH: percentile rank of each scored point's raw
    # anomaly score AGAINST THAT METER'S OWN TRAINING-SET SCORE
    # DISTRIBUTION (not the scoring window). The training set is what the
    # model learned "normal" from, so it's a fixed, meaningful reference
    # population - unlike the scoring window, it doesn't move/stretch
    # depending on what happens to be in front of it. A scoring-window
    # point that looks like anything the model already saw as normal
    # during training gets a low percentile; a point more extreme than
    # everything in training gets pushed toward 100 - and, critically, a
    # scoring window made entirely of mild points now correctly stays
    # low across the board, rather than being artificially stretched to
    # fill 0-100.
    #
    # This does NOT claim cross-meter comparability of absolute
    # magnitude (a percentile is relative to that meter's own training
    # distribution, same as deviation_z is relative to that meter's own
    # rolling std in baseline.py - this is the same per-meter-
    # normalization philosophy already used there, Part 5's decision).
    # It also is not, and is never described as, a probability of theft.
    train_scores = -model.decision_function(train_X)
    raw_scores = -model.decision_function(score_X)

    sorted_train_scores = np.sort(train_scores)
    # searchsorted gives, for each score, how many training scores are
    # <= it - dividing by len gives a 0-1 percentile rank; side='right'
    # so a score tied with the training max still lands at 100, not just
    # under it.
    ranks = np.searchsorted(sorted_train_scores, raw_scores, side='right')
    severity = (ranks / len(sorted_train_scores)) * 100
    severity = np.clip(severity, 0, 100)

    result = score_clean.copy()
    result['isolation_forest_severity'] = severity
    result['isolation_forest_raw_score'] = raw_scores  # kept for inspection/debugging - not used downstream
    return result
