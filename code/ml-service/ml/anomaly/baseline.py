"""
UC1 statistical baseline. Transparent, threshold-based, no ML - every
signal here is a direct function of features Phase A.5 already computed
(deviation_z, pct_change_prev, deviation_from_same_hour_last_week), so
nothing here can leak future information that wasn't already leakage-safe
upstream.

This exists as a baseline to compare Isolation Forest against (Part 9),
and as a fallback for meters with too little history for a reliable
per-meter Isolation Forest model (Part 5 / min_observations_per_meter).
"""

import numpy as np
import pandas as pd

from ..config import config
from ..logging_config import get_logger

logger = get_logger("anomaly.baseline")


def compute_baseline_signals(df):
    """
    Adds three normalized (per-meter-scaled) signal columns:

    - deviation_z: already per-meter-normalized (z-score against that
      meter's own rolling 1-day mean/std) - computed upstream in
      feature_engineering.py, used as-is here.
    - pct_change_signal: absolute value of pct_change_prev - already
      scale-free (a percentage), no further normalization needed.
    - same_week_deviation_z: deviation_from_same_hour_last_week, newly
      normalized HERE by the meter's own rolling_std_1d (with a floor to
      prevent division blowup - see config.same_week_std_floor's
      docstring in config.py for the measured justification). This is
      the Part 5 "per-meter normalization" decision: a 1 kWh jump means
      something very different for a small household than a heavy
      consumer, so every signal is expressed in units of that meter's
      own recent variability, not raw kWh.

    Does not mutate the input; returns a new column set to merge in.
    """
    out = pd.DataFrame(index=df.index)

    out['deviation_z_abs'] = df['deviation_z'].abs()
    out['pct_change_abs'] = df['pct_change_prev'].abs()

    safe_std = df['rolling_std_1d'].clip(lower=config.same_week_std_floor)
    out['same_week_deviation_z'] = (df['deviation_from_same_hour_last_week'] / safe_std).abs()

    return out


def _signal_strength(value, review_threshold, high_threshold):
    """
    Maps a raw (already-normalized) signal magnitude to a 0-1 "strength"
    for the combined severity score: 0 below the REVIEW threshold, 1 at or
    above the HIGH threshold, linear in between. NaN (signal unavailable
    for this row - e.g. rolling_std_1d wasn't defined yet) maps to 0, not
    dropped - an unavailable signal contributes nothing rather than
    crashing or silently biasing the score.
    """
    strength = (value - review_threshold) / (high_threshold - review_threshold)
    strength = strength.clip(lower=0, upper=1)
    return strength.fillna(0.0)


def compute_baseline_severity(df):
    """
    Combines the three baseline signals into one 0-100 severity score.

    Combination rule: severity = 100 * max(signal_strengths). Chosen over
    an average specifically because these are independent risk vectors
    (a sudden spike vs. a persistent weekly-pattern break are different
    kinds of unusual behavior) - averaging would let one strong signal get
    diluted by two quiet ones, which is the wrong direction for a
    screening tool whose job is not to miss things. This is a documented,
    fixed rule, not a learned/tuned weighting - there's no label to tune
    weights against.

    Returns (severity_0_100, signals_df) where signals_df has the raw
    normalized signal values (for explainability.py to read from) plus
    each one's 0-1 strength.
    """
    signals = compute_baseline_signals(df)

    signals['deviation_z_strength'] = _signal_strength(
        signals['deviation_z_abs'], config.deviation_z_review_threshold, config.deviation_z_high_threshold
    )
    signals['pct_change_strength'] = _signal_strength(
        signals['pct_change_abs'], config.pct_change_review_threshold, config.pct_change_high_threshold
    )
    signals['same_week_strength'] = _signal_strength(
        signals['same_week_deviation_z'],
        config.same_week_deviation_review_threshold, config.same_week_deviation_high_threshold,
    )

    combined = signals[['deviation_z_strength', 'pct_change_strength', 'same_week_strength']].max(axis=1)
    severity = (combined * 100).round(2)

    return severity, signals


def run_baseline(df):
    """
    Convenience entrypoint: returns the input df with `baseline_severity`
    and the underlying signal columns attached.
    """
    severity, signals = compute_baseline_severity(df)
    out = df.copy()
    out['baseline_severity'] = severity
    for col in signals.columns:
        out[col] = signals[col]
    return out
