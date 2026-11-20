import pandas as pd
import pytest

from ml.preprocessing.validation import (
    validate_required_columns,
    validate_no_missing_essentials,
    validate_timestamp_ordering,
    validate_no_duplicates,
    validate_consumption_range,
    validate_timestamp_validity,
    validate_meter_id_validity,
    validate_region,
    run_all_validations,
    validate_preprocessing,
)


def _good_df():
    return pd.DataFrame({
        'meter_id': ['BR01', 'BR01', 'MH01'],
        'timestamp': pd.to_datetime(['2020-01-01 00:00', '2020-01-01 00:03', '2020-01-01 00:00']),
        'consumption': [0.01, 0.02, 0.03],
        'region': ['Bareilly', 'Bareilly', 'Mathura'],
    })


def test_validate_required_columns_passes():
    ok, missing = validate_required_columns(_good_df())
    assert ok
    assert missing == []


def test_validate_required_columns_fails_when_missing():
    df = _good_df().drop(columns=['consumption'])
    ok, missing = validate_required_columns(df)
    assert not ok
    assert 'consumption' in missing


def test_validate_no_missing_essentials_fails_on_null():
    df = _good_df()
    df.loc[0, 'consumption'] = None
    ok, bad = validate_no_missing_essentials(df)
    assert not ok
    assert bad['consumption'] == 1


def test_validate_timestamp_ordering_passes_when_sorted():
    ok, bad_meters = validate_timestamp_ordering(_good_df())
    assert ok
    assert bad_meters == []


def test_validate_timestamp_ordering_fails_when_unsorted():
    df = _good_df().iloc[[1, 0, 2]].reset_index(drop=True)  # BR01 rows swapped
    ok, bad_meters = validate_timestamp_ordering(df)
    assert not ok
    assert 'BR01' in bad_meters


def test_validate_no_duplicates_passes():
    ok, count = validate_no_duplicates(_good_df())
    assert ok
    assert count == 0


def test_validate_no_duplicates_fails():
    df = pd.concat([_good_df(), _good_df().iloc[[0]]], ignore_index=True)
    ok, count = validate_no_duplicates(df)
    assert not ok
    assert count == 1


def test_validate_consumption_range_fails_on_absurd_value():
    df = _good_df()
    df.loc[0, 'consumption'] = 500.0  # way above the 1.0 kWh/3-min ceiling
    ok, count = validate_consumption_range(df)
    assert not ok
    assert count == 1


def test_validate_timestamp_validity_fails_on_string_column():
    df = _good_df()
    df['timestamp'] = df['timestamp'].astype(str)
    ok, detail = validate_timestamp_validity(df)
    assert not ok


def test_validate_meter_id_validity_fails_on_bad_prefix():
    df = _good_df()
    df.loc[0, 'meter_id'] = 'XYZ99'
    ok, bad_ids = validate_meter_id_validity(df)
    assert not ok
    assert 'XYZ99' in bad_ids


def test_validate_region_fails_on_unknown():
    df = _good_df()
    df.loc[0, 'region'] = 'Unknown'
    ok, count = validate_region(df)
    assert not ok
    assert count == 1


def test_run_all_validations_passes_on_good_data():
    all_ok, report = run_all_validations(_good_df())
    assert all_ok
    assert all(r['passed'] for r in report.values())


def test_run_all_validations_fails_on_duplicates_and_this_is_a_real_gate():
    """
    This is the direct regression test for the audit's CRITICAL finding:
    validate_no_duplicates()/validate_consumption_range() used to be
    computed and printed but never actually blocked the pipeline. Here we
    confirm run_all_validations() reports overall failure - and
    pipeline.py is expected to raise when this is False (see
    test_pipeline_e2e.py).
    """
    df = pd.concat([_good_df(), _good_df().iloc[[0]]], ignore_index=True)  # inject a duplicate
    all_ok, report = run_all_validations(df)
    assert not all_ok
    assert report['no_duplicates']['passed'] is False


def test_validate_preprocessing_backwards_compatible_signature():
    ok, errors = validate_preprocessing(_good_df())
    assert isinstance(ok, bool)
    assert isinstance(errors, list)
    assert ok
    assert errors == []
