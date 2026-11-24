import pandas as pd
import numpy as np
import pytest

from ml.features.feature_engineering import (
    add_time_features,
    add_lag_features,
    add_rolling_features,
    add_change_features,
    build_features,
    INTERVALS_PER_HOUR,
    INTERVALS_PER_DAY,
    INTERVALS_PER_WEEK,
)
from ml.features.calendar_features import add_calendar_features


def test_add_time_features_basic():
    df = pd.DataFrame({
        'meter_id': ['BR01'] * 3,
        'timestamp': pd.to_datetime(['2020-01-01 08:00', '2020-01-04 13:00', '2020-01-05 20:00']),  # Wed, Sat, Sun
        'consumption': [0.01, 0.02, 0.03],
    })
    out = add_time_features(df)
    assert out['hour'].tolist() == [8, 13, 20]
    assert out['is_weekend'].tolist() == [0, 1, 1]  # Sat/Sun flagged
    assert out['time_of_day'].tolist() == ['morning', 'afternoon', 'evening']


def test_add_lag_features_values_correct(clean_timeseries_df):
    df = add_lag_features(clean_timeseries_df.copy())
    # lag_1_interval at row i should equal consumption at row i-1
    shifted_expected = clean_timeseries_df['consumption'].shift(1)
    pd.testing.assert_series_equal(df['lag_1_interval'], shifted_expected, check_names=False)

    # lag_1w should equal consumption exactly INTERVALS_PER_WEEK rows earlier
    expected_1w = clean_timeseries_df['consumption'].shift(INTERVALS_PER_WEEK)
    pd.testing.assert_series_equal(df['lag_1w'], expected_1w, check_names=False)


def test_add_lag_features_does_not_cross_meter_boundaries():
    df = pd.DataFrame({
        'meter_id': ['BR01', 'BR01', 'MH01', 'MH01'],
        'timestamp': pd.to_datetime(['2020-01-01 00:00', '2020-01-01 00:03',
                                       '2020-01-01 00:00', '2020-01-01 00:03']),
        'consumption': [1.0, 2.0, 100.0, 200.0],
    })
    out = add_lag_features(df)
    # MH01's first row must NOT see BR01's last value as its lag
    mh01_first = out[(out['meter_id'] == 'MH01')].iloc[0]
    assert pd.isna(mh01_first['lag_1_interval'])


def test_add_rolling_features_shifted_before_window(clean_timeseries_df):
    """
    The core leakage-prevention property for rolling features: the value
    at row t must not include consumption[t] itself.
    """
    df = add_rolling_features(clean_timeseries_df.copy(), windows={'1h': INTERVALS_PER_HOUR})
    # manually compute what rolling_mean_1h SHOULD be at a row deep enough
    # to have a full window: mean of consumption[t-20 .. t-1], not including t
    idx = 100
    manual = clean_timeseries_df['consumption'].iloc[idx - INTERVALS_PER_HOUR: idx].mean()
    assert np.isclose(df['rolling_mean_1h'].iloc[idx], manual)


def test_add_change_features_abs_and_pct(clean_timeseries_df):
    df = add_lag_features(clean_timeseries_df.copy())
    df = add_rolling_features(df, windows={'1d': INTERVALS_PER_DAY})
    df = add_change_features(df)
    assert 'abs_change_prev' in df.columns
    assert 'deviation_z' in df.columns
    # abs_change_prev should equal consumption - lag_1_interval exactly
    valid = df['lag_1_interval'].notna()
    diff = df.loc[valid, 'consumption'] - df.loc[valid, 'lag_1_interval']
    pd.testing.assert_series_equal(df.loc[valid, 'abs_change_prev'], diff, check_names=False)


def test_add_change_features_no_divide_by_zero_inf():
    df = pd.DataFrame({
        'consumption': [0.0, 0.5],
        'lag_1_interval': [0.0, 0.0],  # both would divide by zero if unguarded
    })
    out = add_change_features(df)
    assert not np.isinf(out['pct_change_prev']).any()


def test_build_features_runs_end_to_end(clean_timeseries_df):
    out = build_features(clean_timeseries_df.copy())
    expected_cols = {'hour', 'day_of_week', 'lag_1_interval', 'lag_1w',
                      'rolling_mean_1d', 'deviation_z', 'abs_change_prev'}
    assert expected_cols.issubset(out.columns)
    assert len(out) == len(clean_timeseries_df)


def test_unsorted_input_is_handled_safely_not_silently_wrong(clean_timeseries_df):
    """
    Priority 7 regression test: feeding add_lag_features() an UNSORTED
    dataframe must not silently produce wrong lag values. The chosen fix
    sorts internally, so the result should be IDENTICAL to running on the
    already-sorted version, not merely "not crash".
    """
    sorted_df = clean_timeseries_df.copy()
    shuffled_df = sorted_df.sample(frac=1.0, random_state=0).reset_index(drop=True)

    result_from_sorted = add_lag_features(sorted_df.copy())
    result_from_shuffled = add_lag_features(shuffled_df.copy())

    # re-sort both results the same way before comparing, since row order
    # in the output naturally follows input order for the sorted case but
    # gets corrected internally for the shuffled case
    a = result_from_sorted.sort_values(['meter_id', 'timestamp']).reset_index(drop=True)
    b = result_from_shuffled.sort_values(['meter_id', 'timestamp']).reset_index(drop=True)

    pd.testing.assert_series_equal(a['lag_1_interval'], b['lag_1_interval'], check_names=False)
    pd.testing.assert_series_equal(a['lag_1w'], b['lag_1w'], check_names=False)


def test_add_calendar_features_flags_known_holiday():
    df = pd.DataFrame({
        'timestamp': pd.to_datetime(['2020-08-15 10:00', '2020-08-16 10:00']),  # Independence Day, then not
    })
    out = add_calendar_features(df)
    assert out['is_holiday'].tolist() == [1, 0]
    assert out['holiday_name'].iloc[0] == 'Independence Day'
    assert pd.isna(out['holiday_name'].iloc[1])
