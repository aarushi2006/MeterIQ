import pandas as pd

from ml.preprocessing.cleaning import (
    standardize_dataset,
    clean_dataset,
    add_region,
    flag_sensor_dropout,
    flag_voltage_outliers,
    run_dropout_policy,
)


def test_standardize_dataset_renames_columns(raw_like_df):
    std = standardize_dataset(raw_like_df)
    assert set(['meter_id', 'timestamp', 'consumption', 'average_voltage',
                'average_current', 'frequency_hz']).issubset(std.columns)
    assert 'meter' not in std.columns
    assert 'x_Timestamp' not in std.columns
    assert 't_kWh' not in std.columns


def test_standardize_dataset_converts_types(raw_like_df):
    std = standardize_dataset(raw_like_df)
    assert pd.api.types.is_datetime64_any_dtype(std['timestamp'])
    assert pd.api.types.is_numeric_dtype(std['consumption'])


def test_standardize_dataset_removes_duplicates(raw_like_df):
    std = standardize_dataset(raw_like_df)
    dup_count = std.duplicated(subset=['meter_id', 'timestamp']).sum()
    assert dup_count == 0
    # 9 input rows, 1 exact duplicate (meter_id, timestamp) pair -> 8 rows left
    assert len(std) == 8


def test_standardize_dataset_sorts_by_meter_and_time(raw_like_df):
    std = standardize_dataset(raw_like_df)
    for meter_id, group in std.groupby('meter_id'):
        assert group['timestamp'].is_monotonic_increasing


def test_clean_dataset_removes_negative_consumption(raw_like_df):
    std = standardize_dataset(raw_like_df)
    cleaned = clean_dataset(std)
    assert (cleaned['consumption'] >= 0).all()
    # the one negative-consumption row should be gone
    assert len(cleaned) == len(std) - 1


def test_clean_dataset_removes_missing_essentials():
    df = pd.DataFrame({
        'meter_id': ['BR01', None, 'BR01'],
        'timestamp': pd.to_datetime(['2020-01-01', '2020-01-01', '2020-01-01']),
        'consumption': [0.01, 0.02, None],
    })
    cleaned = clean_dataset(df)
    assert len(cleaned) == 1


def test_add_region_derives_from_prefix(raw_like_df):
    std = standardize_dataset(raw_like_df)
    with_region = add_region(std)
    regions = with_region.set_index('meter_id')['region'].to_dict()
    assert regions['BR01'] == 'Bareilly'
    assert regions['MH01'] == 'Mathura'


def test_add_region_unknown_prefix():
    df = pd.DataFrame({'meter_id': ['XYZ99'], 'timestamp': pd.to_datetime(['2020-01-01']), 'consumption': [0.01]})
    result = add_region(df)
    assert result['region'].iloc[0] == 'Unknown'


def test_flag_sensor_dropout_detects_all_zero_rows(raw_like_df):
    std = standardize_dataset(raw_like_df)
    flagged = flag_sensor_dropout(std)
    dropout_rows = flagged[flagged['is_dropout_artifact']]
    assert len(dropout_rows) == 1
    assert dropout_rows.iloc[0]['consumption'] == 0.0


def test_flag_sensor_dropout_ignores_genuine_zero_kwh():
    # consumption == 0 but voltage/current/freq are non-zero -> NOT a dropout artifact
    df = pd.DataFrame({
        'meter_id': ['BR01'], 'timestamp': pd.to_datetime(['2020-01-01']),
        'consumption': [0.0], 'average_voltage': [230.0],
        'average_current': [0.0], 'frequency_hz': [50.0],
    })
    flagged = flag_sensor_dropout(df)
    assert flagged['is_dropout_artifact'].iloc[0] == False  # noqa: E712


def test_run_dropout_policy_drops_by_default(raw_like_df):
    std = standardize_dataset(raw_like_df)
    result, n_flagged = run_dropout_policy(std)
    assert n_flagged == 1
    assert 'is_dropout_artifact' not in result.columns
    assert len(result) == len(std) - 1


def test_run_dropout_policy_can_keep_rows(raw_like_df):
    std = standardize_dataset(raw_like_df)
    result, n_flagged = run_dropout_policy(std, drop_dropout_rows=False)
    assert n_flagged == 1
    assert 'is_dropout_artifact' in result.columns
    assert len(result) == len(std)  # nothing removed


def test_flag_voltage_outliers(raw_like_df):
    std = standardize_dataset(raw_like_df)
    flagged = flag_voltage_outliers(std)
    outlier_rows = flagged[flagged['is_voltage_outlier']]
    # the MH01 row with voltage=600 is the only outlier among non-dropout rows
    assert (outlier_rows['average_voltage'] == 600.0).any()
