import numpy as np
import pandas as pd
import pytest

from ml.anomaly.isolation_forest import chronological_split, fit_and_score_meter, _prepare_feature_matrix
from ml.config import config


def _synthetic_meter_df(n=5000, seed=0):
    rng = np.random.RandomState(seed)
    ts = pd.date_range('2020-01-01', periods=n, freq='3min')
    df = pd.DataFrame({
        'meter_id': 'BR01',
        'timestamp': ts,
        'consumption': 0.01 + rng.normal(0, 0.002, n),
        'lag_1_interval': 0.01 + rng.normal(0, 0.002, n),
        'lag_1h': 0.01 + rng.normal(0, 0.002, n),
        'lag_4h': 0.01 + rng.normal(0, 0.002, n),
        'lag_1d': 0.01 + rng.normal(0, 0.002, n),
        'lag_1w': 0.01 + rng.normal(0, 0.002, n),
        'rolling_mean_1h': 0.01 + rng.normal(0, 0.001, n),
        'rolling_std_1h': np.abs(rng.normal(0.001, 0.0005, n)),
        'rolling_mean_1d': 0.01 + rng.normal(0, 0.001, n),
        'rolling_std_1d': np.abs(rng.normal(0.001, 0.0005, n)),
        'abs_change_prev': rng.normal(0, 0.001, n),
        'pct_change_prev': rng.normal(0, 0.05, n),
        'deviation_from_rolling_mean': rng.normal(0, 0.001, n),
        'deviation_z': rng.normal(0, 0.5, n),
        'deviation_from_same_hour_last_week': rng.normal(0, 0.001, n),
        'hour': ts.hour,
        'day_of_week': ts.dayofweek,
        'is_weekend': (ts.dayofweek >= 5).astype(int),
    })
    return df


def test_chronological_split_is_strictly_ordered():
    df = _synthetic_meter_df(n=100)
    train, score = chronological_split(df, train_fraction=0.7)
    assert len(train) == 70
    assert len(score) == 30
    assert train['timestamp'].max() < score['timestamp'].min()


def test_chronological_split_no_overlap():
    df = _synthetic_meter_df(n=1000)
    train, score = chronological_split(df)
    train_ts = set(train['timestamp'])
    score_ts = set(score['timestamp'])
    assert train_ts.isdisjoint(score_ts)


def test_fit_and_score_returns_none_below_min_observations(monkeypatch):
    monkeypatch.setattr(config, 'min_observations_per_meter', 10_000)  # deliberately higher than the sample
    df = _synthetic_meter_df(n=500)
    result = fit_and_score_meter(df)
    assert result is None


def test_fit_and_score_meter_only_scores_the_held_out_portion():
    df = _synthetic_meter_df(n=5000)
    train, score = chronological_split(df)
    result = fit_and_score_meter(df)
    assert result is not None
    # every scored timestamp must come from the score portion, never train
    assert set(result['timestamp']).issubset(set(score['timestamp']))
    assert set(result['timestamp']).isdisjoint(set(train['timestamp']))


def test_isolation_forest_severity_in_valid_range():
    df = _synthetic_meter_df(n=5000)
    result = fit_and_score_meter(df)
    assert result is not None
    assert result['isolation_forest_severity'].between(0, 100).all()


def test_severity_does_not_force_every_window_to_span_0_to_100():
    """
    Regression test for the exact bug reported: the old implementation
    min-max scaled WITHIN the scoring window, so any window's own min/max
    became ~0/~100 regardless of how anomalous the points actually were.
    A scoring window made entirely of points that look just like the
    training distribution should score LOW across the board, not be
    artificially stretched to fill the full 0-100 range.
    """
    rng = np.random.RandomState(1)
    n = 5000
    ts = pd.date_range('2020-01-01', periods=n, freq='3min')
    # training portion: normal noise. Scoring portion: SAME distribution,
    # no injected anomaly at all - every scored point should look mundane
    # relative to training, not get artificially spread across 0-100.
    consumption = 0.01 + rng.normal(0, 0.001, n)
    df = _synthetic_meter_df(n=n, seed=1)
    df['consumption'] = consumption

    result = fit_and_score_meter(df)
    assert result is not None
    # with no genuine anomaly in the scoring window, severities should be
    # concentrated at the low end, not spread with a max forced near 100
    assert result['isolation_forest_severity'].max() < 100, (
        "severity forced to span up to 100 even though nothing in the scoring "
        "window differs from training - this is the bug being regression-tested"
    )
    assert result['isolation_forest_severity'].median() < 60


def test_severity_reflects_genuine_novelty_relative_to_training():
    """
    Complementary case: when the scoring portion DOES contain a point
    that's genuinely more extreme than anything in training, it should
    score high - the calibration should still be sensitive to real
    novelty, not just refuse to ever say anything is anomalous.

    Note: the injected outlier must be extreme across MULTIPLE correlated
    features, not just one or two - _synthetic_meter_df() generates each
    feature as independent random noise, so a point that's only extreme
    in 1-2 of 18 dimensions isn't necessarily a strong multivariate
    outlier to Isolation Forest (this was verified empirically: an
    earlier version of this test set only consumption+deviation_z and
    measured severity=59.2, not the >90 expected - fixed by making the
    injection consistent across every behavioral feature instead).
    """
    df = _synthetic_meter_df(n=5000, seed=2)
    train, score = chronological_split(df)
    score_idx = score.index[len(score) // 2]
    extreme_cols = ['consumption', 'lag_1_interval', 'lag_1h', 'lag_4h', 'lag_1d', 'lag_1w',
                     'rolling_mean_1h', 'rolling_mean_1d', 'abs_change_prev',
                     'deviation_from_rolling_mean']
    for col in extreme_cols:
        df.loc[score_idx, col] = 5.0  # far outside the ~0.01-scale training distribution
    df.loc[score_idx, 'deviation_z'] = 20.0
    df.loc[score_idx, 'pct_change_prev'] = 50.0

    result = fit_and_score_meter(df)
    assert result is not None
    injected_row = result[result['timestamp'] == df.loc[score_idx, 'timestamp']]
    assert len(injected_row) == 1
    assert injected_row['isolation_forest_severity'].iloc[0] > 80


def test_isolation_forest_reproducible_with_same_seed():
    df = _synthetic_meter_df(n=5000)
    result_a = fit_and_score_meter(df)
    result_b = fit_and_score_meter(df)
    assert result_a is not None and result_b is not None
    np.testing.assert_array_almost_equal(
        result_a['isolation_forest_severity'].to_numpy(),
        result_b['isolation_forest_severity'].to_numpy(),
    )


def test_prepare_feature_matrix_drops_nan_rows_and_logs_count():
    df = pd.DataFrame({'a': [1.0, np.nan, 3.0], 'b': [1.0, 2.0, np.nan]})
    clean, matrix = _prepare_feature_matrix(df, ['a', 'b'])
    assert len(clean) == 1  # only the first row has no NaN in either column
    assert matrix.shape == (1, 2)


def test_prepare_feature_matrix_handles_missing_optional_columns():
    """Electrical quality columns (average_voltage etc.) may not exist -
    must not crash, just skip them with a warning."""
    df = pd.DataFrame({'consumption': [1.0, 2.0]})
    clean, matrix = _prepare_feature_matrix(df, ['consumption', 'average_voltage'])
    assert matrix.shape == (2, 1)  # only 'consumption' was actually available
