import pandas as pd
import numpy as np
from ml.config import config

# Constants expected by the test suite
RISK_NORMAL = "NORMAL"
RISK_REVIEW = "REVIEW"
RISK_HIGH = "HIGH_RISK"


def _isolation_forest_strength(severity: pd.Series) -> pd.Series:
    """
    Convert an Isolation Forest percentile severity to a 0-1 strength using
    the percentiles that are actually meaningful on that scale.

    The IF score is a percentile rank, so the baseline's review/high
    thresholds (20/55) are not applicable to it. Using them directly was a
    real bug in Phase B.1 (83% flag rate from IF alone); the configured
    90/97 percentiles are the calibrated thresholds for this component.
    Missing values mean the model was not used for that meter/row and must
    contribute nothing rather than being treated as an anomaly.
    """
    review = config.isolation_forest_review_percentile
    high = config.isolation_forest_high_percentile
    span = high - review
    if span <= 0:
        return (severity >= high).astype(float).fillna(0.0)

    strength = (severity - review) / span
    return strength.clip(lower=0.0, upper=1.0).fillna(0.0)


def combine_severity(df: pd.DataFrame) -> pd.DataFrame:
    """
    Combine the transparent statistical baseline and the per-meter
    Isolation Forest into one 0-100 severity.

    Each component is first expressed on its own calibrated 0-1 scale:
    baseline_severity is already 0-100 from baseline.py, and the IF
    percentile is converted with its own 90/97 thresholds. The combined
    score is their maximum, matching the documented methodology: a strong
    signal from either detector is enough to put a row up for review, and
    one quiet component must not dilute the other.
    """
    df = df.copy()

    if 'baseline_severity' in df.columns:
        baseline = pd.to_numeric(df['baseline_severity'], errors='coerce')
    else:
        baseline = pd.Series(0.0, index=df.index)
    baseline = baseline.fillna(0.0).clip(lower=0.0, upper=100.0)

    if 'isolation_forest_severity' in df.columns:
        if_severity = pd.to_numeric(
            df['isolation_forest_severity'], errors='coerce'
        )
        if_score = _isolation_forest_strength(if_severity) * 100.0
    else:
        if_score = pd.Series(0.0, index=df.index)

    df['combined_severity'] = np.maximum(baseline, if_score).round(2)
    return df


def assign_risk_level(df: pd.DataFrame) -> pd.DataFrame:
    """
    Maps the combined severity score to a risk category.
    """
    df = df.copy()

    def map_severity(val):
        # Correctly use the 'config' instance, not the 'Config' class
        if val >= config.risk_high_severity:
            return RISK_HIGH
        elif val >= config.risk_review_severity:
            return RISK_REVIEW
        else:
            return RISK_NORMAL

    df['risk_level'] = df['combined_severity'].apply(map_severity)
    return df


def run_scoring(df: pd.DataFrame) -> pd.DataFrame:
    """
    Main scoring entry point.
    Combines signals, assigns risk, and handles data quality flags.
    """
    df = df.copy()

    df = combine_severity(df)
    df = assign_risk_level(df)

    if 'is_voltage_outlier' in df.columns:
        df['data_quality_flag'] = df['is_voltage_outlier']
    else:
        df['data_quality_flag'] = False

    df['explanation'] = "Analyzed via Consensus Scoring Model"

    return df
