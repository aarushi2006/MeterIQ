import numpy as np
import pandas as pd
import pytest

from ml.anomaly.baseline import compute_baseline_signals, compute_baseline_severity, run_baseline
from ml.anomaly.scoring import run_scoring, RISK_NORMAL, RISK_REVIEW, RISK_HIGH
from ml.config import config


def _stable_meter_df(n=600):
    """Flat, low-variance consumption - should NOT be flagged."""
    rng = np.random.RandomState(0)
    consumption = 0.01 + rng.normal(0, 0.0005, n)  # tiny noise around a flat baseline
    return pd.DataFrame({
        'meter_id': 'BR01',
        'timestamp': pd.date_range('2020-01-01', periods=n, freq='3min'),
        'consumption': consumption,
        'deviation_z': rng.normal(0, 0.3, n),          # small, unremarkable deviations
        'pct_change_prev': rng.normal(0, 0.05, n),
        'deviation_from_same_hour_last_week': rng.normal(0, 0.001, n),
        'rolling_std_1d': np.full(n, 0.0005),
    })


def _spike_row(base_df, idx=300):
    """Injects one obvious, large spike at idx into a copy of base_df's signal columns."""
    df = base_df.copy()
    df.loc[idx, 'deviation_z'] = 6.0          # far beyond the review/high thresholds
    df.loc[idx, 'pct_change_prev'] = 5.0      # 500% jump
    return df


def test_compute_baseline_signals_shapes(): 
    df = _stable_meter_df()
    signals = compute_baseline_signals(df)
    assert len(signals) == len(df)
    assert {'deviation_z_abs', 'pct_change_abs', 'same_week_deviation_z'}.issubset(signals.columns)


def test_stable_consumption_is_not_flagged():
    """A normal, stable meter should mostly score NORMAL - the core false-positive check."""
    df = _stable_meter_df()
    scored = run_scoring(run_baseline(df))
    flagged_rate = (scored['risk_level'] != RISK_NORMAL).mean()
    assert flagged_rate < 0.05, f"stable consumption flagged at {flagged_rate:.1%} - too sensitive"


def test_obvious_spike_is_detected():
    """An injected, unambiguous spike must be flagged, not missed."""
    df = _spike_row(_stable_meter_df())
    scored = run_scoring(run_baseline(df))
    spike_row = scored.iloc[300]
    assert spike_row['risk_level'] in (RISK_REVIEW, RISK_HIGH)
    assert spike_row['baseline_severity'] > 0


def test_severity_is_monotonic_in_deviation_z():
    """Larger deviation_z should never produce a smaller severity, all else equal."""
    df = _stable_meter_df(n=10)
    df['pct_change_prev'] = 0.0
    df['deviation_from_same_hour_last_week'] = 0.0
    df['deviation_z'] = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0]
    severity, _ = compute_baseline_severity(df)
    assert (severity.diff().dropna() >= 0).all()


def test_missing_optional_electrical_columns_handled_safely():
    """
    average_voltage/average_current/frequency_hz are optional (Part 16 /
    the daily-aggregate files don't have them). The baseline must not
    crash when they're absent - it doesn't use them directly anyway
    (voltage handling is scoring.py's data_quality_flag, which itself
    must degrade gracefully to False when is_voltage_outlier is missing).
    """
    df = _stable_meter_df()
    assert 'average_voltage' not in df.columns
    scored = run_scoring(run_baseline(df))  # must not raise
    assert (scored['data_quality_flag'] == False).all()  # noqa: E712


def test_risk_level_mapping_thresholds():
    df = pd.DataFrame({'baseline_severity': [0, 10, config.risk_review_severity, config.risk_high_severity, 100]})
    df['combined_severity'] = df['baseline_severity']
    from ml.anomaly.scoring import assign_risk_level
    result = assign_risk_level(df)
    assert result['risk_level'].iloc[0] == RISK_NORMAL
    assert result['risk_level'].iloc[2] == RISK_REVIEW
    assert result['risk_level'].iloc[3] == RISK_HIGH
    assert result['risk_level'].iloc[4] == RISK_HIGH


def test_data_quality_flag_separated_from_behavioral_risk():
    """
    Part 16: a voltage-outlier row must be marked data_quality_flag=True
    even if its behavioral signals are unremarkable - the two are
    independent, not conflated.
    """
    df = _stable_meter_df(n=5)
    df['is_voltage_outlier'] = [False, True, False, False, False]
    scored = run_scoring(run_baseline(df))
    assert scored['data_quality_flag'].tolist() == [False, True, False, False, False]


def test_isolation_forest_severity_needs_its_own_high_percentile_to_flag():
    """
    Regression test for the real bug found in Phase B.1: isolation_forest_severity
    is a percentile rank (near-uniform by construction when train/score
    distributions match), so a raw value of 20 there means "more
    anomalous than only the bottom 20%" - applying the baseline's
    review=20 threshold directly to it produced an 83% flag rate on real
    data. A moderate IF percentile (e.g. 40, comfortably below
    isolation_forest_review_percentile=90) combined with an unremarkable
    baseline must NOT push the combined result into REVIEW/HIGH_RISK.
    """
    from ml.anomaly.scoring import combine_severity, assign_risk_level, RISK_NORMAL
    df = pd.DataFrame({
        'baseline_severity': [0.0],
        'isolation_forest_severity': [40.0],  # far below the 90/97 percentile thresholds
    })
    df = combine_severity(df)
    df = assign_risk_level(df)
    assert df['risk_level'].iloc[0] == RISK_NORMAL, (
        f"IF severity=40 (a moderate percentile, not a strong signal) wrongly escalated risk "
        f"to {df['risk_level'].iloc[0]} - combined_severity={df['combined_severity'].iloc[0]}"
    )


def test_isolation_forest_severity_above_high_percentile_does_flag():
    """Complementary case: a genuinely extreme IF percentile should escalate risk."""
    from ml.anomaly.scoring import combine_severity, assign_risk_level, RISK_NORMAL
    df = pd.DataFrame({
        'baseline_severity': [0.0],
        'isolation_forest_severity': [99.0],  # above isolation_forest_high_percentile=97
    })
    df = combine_severity(df)
    df = assign_risk_level(df)
    assert df['risk_level'].iloc[0] != RISK_NORMAL
