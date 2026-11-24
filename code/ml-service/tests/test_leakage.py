"""
Priority 6: explicit leakage tests. The method used throughout this file
is the one specified in the brief: build a small time series, compute
features, then MODIFY ONLY A FUTURE OBSERVATION, recompute, and assert
that every feature value at or before the modified timestamp is
unchanged. If any of these fail, a feature is leaking future information
into the past and must be fixed before UC1/UC2 are built on top of it.
"""

import pandas as pd
import numpy as np

from ml.features.feature_engineering import (
    add_lag_features,
    add_rolling_features,
    add_change_features,
    build_features,
    INTERVALS_PER_HOUR,
    INTERVALS_PER_WEEK,
)


def _make_series(periods=24 * 20 * 8):  # 8 days at 3-min resolution
    ts = pd.date_range('2020-01-01', periods=periods, freq='3min')
    values = [0.01 + 0.001 * (i % 50) for i in range(periods)]
    return pd.DataFrame({'meter_id': 'BR01', 'timestamp': ts, 'consumption': values})


def _perturb_future(df, cutoff_idx, new_value=999.0):
    """Returns a copy with every row AFTER cutoff_idx set to new_value."""
    out = df.copy()
    out.loc[out.index > cutoff_idx, 'consumption'] = new_value
    return out


def test_rolling_mean_unaffected_by_future_values():
    df = _make_series()
    cutoff = 300  # comfortably past the 1h/1d warm-up windows

    original = add_rolling_features(df.copy(), windows={'1h': INTERVALS_PER_HOUR})
    perturbed = add_rolling_features(_perturb_future(df, cutoff), windows={'1h': INTERVALS_PER_HOUR})

    before = original.loc[:cutoff, 'rolling_mean_1h']
    after_perturb = perturbed.loc[:cutoff, 'rolling_mean_1h']
    pd.testing.assert_series_equal(before, after_perturb, check_names=False)


def test_rolling_std_unaffected_by_future_values():
    df = _make_series()
    cutoff = 300

    original = add_rolling_features(df.copy(), windows={'1h': INTERVALS_PER_HOUR})
    perturbed = add_rolling_features(_perturb_future(df, cutoff), windows={'1h': INTERVALS_PER_HOUR})

    before = original.loc[:cutoff, 'rolling_std_1h']
    after_perturb = perturbed.loc[:cutoff, 'rolling_std_1h']
    pd.testing.assert_series_equal(before, after_perturb, check_names=False)


def test_deviation_features_unaffected_by_future_values():
    df = _make_series()
    cutoff = 600  # past the 1-day rolling warm-up too

    def compute(d):
        d = add_lag_features(d)
        d = add_rolling_features(d, windows={'1d': 480})
        return add_change_features(d)

    original = compute(df.copy())
    perturbed = compute(_perturb_future(df, cutoff))

    for col in ('deviation_from_rolling_mean', 'deviation_z', 'abs_change_prev'):
        before = original.loc[:cutoff, col]
        after_perturb = perturbed.loc[:cutoff, col]
        pd.testing.assert_series_equal(before, after_perturb, check_names=False, obj=col)


def test_same_week_lag_unaffected_by_future_values():
    """
    lag_1w looks INTERVALS_PER_WEEK rows into the past. The perturbation
    cutoff here is deliberately placed well past 2 weeks in, so there's a
    clean region before the cutoff whose lag_1w source rows are also
    before the cutoff and therefore must be untouched by a future-only
    perturbation.
    """
    df = _make_series(periods=24 * 20 * 20)  # 20 days, so 2 weeks of clean history exist
    cutoff = INTERVALS_PER_WEEK * 2  # perturb everything after week 2

    original = add_lag_features(df.copy())
    perturbed = add_lag_features(_perturb_future(df, cutoff))

    check_upto = cutoff  # rows at/before cutoff whose lag source (t - 1 week) is also <= cutoff
    before = original.loc[:check_upto, 'lag_1w']
    after_perturb = perturbed.loc[:check_upto, 'lag_1w']
    pd.testing.assert_series_equal(before, after_perturb, check_names=False)


def test_full_build_features_pipeline_no_leakage():
    """End-to-end version of the same property across the full feature set."""
    df = _make_series(periods=24 * 20 * 20)
    cutoff = INTERVALS_PER_WEEK

    original = build_features(df.copy())
    perturbed = build_features(_perturb_future(df, cutoff))

    numeric_feature_cols = [
        c for c in original.columns
        if c not in ('meter_id', 'timestamp', 'consumption', 'time_of_day')
    ]
    before = original.loc[:cutoff, numeric_feature_cols]
    after_perturb = perturbed.loc[:cutoff, numeric_feature_cols]
    pd.testing.assert_frame_equal(before, after_perturb)


def test_rolling_features_do_not_include_the_current_row_itself():
    """
    A distinct leakage vector from "future" leakage: a rolling/lag feature
    at row t must not depend on consumption[t] itself (that's the value
    you're trying to score/predict - it isn't available as an input to its
    own feature at real prediction time). This is NOT caught by the
    future-perturbation tests above, because changing only row t's OWN
    value isn't "the future" relative to t - it's simultaneous with t. Both
    vectors matter and need their own test.

    Method: change ONLY row t's consumption value and confirm every
    rolling/lag feature AT ROW T is unchanged (since none of them should
    read consumption[t]).
    """
    df = _make_series()
    t = 300  # comfortably past every window's warm-up

    original = add_rolling_features(add_lag_features(df.copy()))

    perturbed_input = df.copy()
    perturbed_input.loc[t, 'consumption'] = 12345.0
    perturbed = add_rolling_features(add_lag_features(perturbed_input))

    feature_cols = ['lag_1_interval', 'rolling_mean_1h', 'rolling_std_1h',
                     'rolling_mean_1d', 'rolling_std_1d']
    for col in feature_cols:
        assert original.loc[t, col] == perturbed.loc[t, col], (
            f"{col} at row t changed when only consumption[t] itself was modified - "
            "this feature is reading the current row's own value, which is a real "
            "leakage bug even though it isn't a 'future' timestamp."
        )
