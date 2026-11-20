import json
import numpy as np
import pandas as pd
import pytest

from ml.anomaly.summary import build_meter_summary
from ml.anomaly.scoring import RISK_NORMAL, RISK_REVIEW, RISK_HIGH
import ml.anomaly.pipeline as uc1_pipeline


def _fake_scored_df():
    return pd.DataFrame({
        'meter_id': ['BR01'] * 5 + ['MH01'] * 5,
        'region': ['Bareilly'] * 5 + ['Mathura'] * 5,
        'risk_level': [RISK_NORMAL, RISK_NORMAL, RISK_REVIEW, RISK_HIGH, RISK_NORMAL,
                        RISK_NORMAL, RISK_NORMAL, RISK_NORMAL, RISK_NORMAL, RISK_REVIEW],
        'combined_severity': [0, 5, 45, 90, 2, 0, 1, 3, 4, 42],
        'data_quality_flag': [False, False, False, True, False, False, False, False, False, False],
        'reasons': [
            ["No significant deviation detected."], ["No significant deviation detected."],
            ["Consumption differs substantially from the historical same-hour pattern."],
            ["Consumption is 4.5 standard deviations above the meter's recent (24-hour) baseline."],
            ["No significant deviation detected."],
            ["No significant deviation detected."], ["No significant deviation detected."],
            ["No significant deviation detected."], ["No significant deviation detected."],
            ["Consumption differs substantially from the historical same-hour pattern."],
        ],
    })


def test_meter_summary_counts_are_correct():
    df = _fake_scored_df()
    summary = build_meter_summary(df)
    br01 = summary[summary['meter_id'] == 'BR01'].iloc[0]
    assert br01['total_observations'] == 5
    assert br01['normal_count'] == 3
    assert br01['review_count'] == 1
    assert br01['high_risk_count'] == 1
    assert br01['anomaly_count'] == 2
    assert br01['anomaly_rate'] == 0.4
    assert br01['max_severity'] == 90
    assert br01['data_quality_flag_count'] == 1


def test_meter_summary_uses_neutral_language_in_columns():
    """Part 8: no 'worst offender' framing - just check the columns exist
    and are named neutrally."""
    df = _fake_scored_df()
    summary = build_meter_summary(df)
    forbidden = {'worst', 'offender', 'guilty', 'thief'}
    assert not any(any(f in str(col).lower() for f in forbidden) for col in summary.columns)


def test_meter_summary_top_reasons_reflect_actual_flagged_reasons():
    df = _fake_scored_df()
    summary = build_meter_summary(df)
    mh01 = summary[summary['meter_id'] == 'MH01'].iloc[0]
    assert "historical same-hour pattern" in " ".join(mh01['most_common_reasons'])


def _write_tiny_feature_parquet(path, n_per_meter=3000):
    """
    Builds a small but realistic feature-shaped Parquet file (the same
    columns Phase A.5 actually produces) for two synthetic meters, without
    touching the real 1GB dataset - the required small end-to-end test.
    """
    frames = []
    for meter_id, region, seed in [('BR01', 'Bareilly', 1), ('MH01', 'Mathura', 2)]:
        rng = np.random.RandomState(seed)
        ts = pd.date_range('2020-01-01', periods=n_per_meter, freq='3min')
        consumption = 0.01 + rng.normal(0, 0.002, n_per_meter)
        # inject one obvious spike so the e2e test has something real to flag
        consumption[n_per_meter // 2] += 1.0

        df = pd.DataFrame({
            'timestamp': ts, 'consumption': consumption, 'meter_id': meter_id, 'region': region,
            'average_voltage': 230.0, 'average_current': 0.5, 'frequency_hz': 50.0,
            'is_voltage_outlier': False,
            'hour': ts.hour, 'day_of_week': ts.dayofweek, 'day': ts.day, 'month': ts.month,
            'is_weekend': (ts.dayofweek >= 5).astype(int),
        })
        # lag/rolling/change features - simplified but present under the real column names
        for col in ['lag_1_interval', 'lag_1h', 'lag_4h', 'lag_1d', 'lag_1w',
                    'rolling_mean_1h', 'rolling_median_1h', 'rolling_std_1h', 'rolling_min_1h', 'rolling_max_1h',
                    'rolling_mean_1d', 'rolling_median_1d', 'rolling_std_1d', 'rolling_min_1d', 'rolling_max_1d']:
            df[col] = df['consumption'].shift(1).fillna(0.01)
        df['rolling_std_1d'] = 0.002
        df['rolling_std_1h'] = 0.002
        df['abs_change_prev'] = df['consumption'] - df['lag_1_interval']
        df['pct_change_prev'] = df['abs_change_prev'] / df['lag_1_interval'].replace(0, np.nan)
        df['deviation_from_rolling_mean'] = df['consumption'] - df['rolling_mean_1d']
        df['deviation_z'] = df['deviation_from_rolling_mean'] / df['rolling_std_1d']
        df['deviation_from_same_hour_last_week'] = df['consumption'] - df['lag_1w']
        df['is_holiday'] = 0
        df['holiday_name'] = None
        df['temp_proxy_c'] = 25.0
        df['is_extreme_temp_proxy'] = 0

        frames.append(df)

    combined = pd.concat(frames, ignore_index=True)
    combined.to_parquet(path, index=False)
    return path


def test_end_to_end_uc1_pipeline_small_sample(tmp_path, monkeypatch):
    """
    The required end-to-end UC1 test: small synthetic feature dataset ->
    baseline -> Isolation Forest -> scoring -> explanations -> summary ->
    evaluation -> output files, using the real run_uc1_pipeline()
    function, not a reimplementation of it.
    """
    features_path = tmp_path / "tiny_features.parquet"
    _write_tiny_feature_parquet(features_path, n_per_meter=3000)

    output_dir = tmp_path / "anomaly_output"
    scored_df, meter_summary, manifest = uc1_pipeline.run_uc1_pipeline(
        features_path=str(features_path),
        sample_meters=['BR01', 'MH01'],
        use_isolation_forest=True,
        output_dir=str(output_dir),
        generate_plots=False,  # keep the test fast; plotting is exercised separately
    )

    # basic shape checks
    assert len(scored_df) == 6000
    assert set(scored_df['meter_id'].unique()) == {'BR01', 'MH01'}
    assert set(scored_df['risk_level'].unique()).issubset({RISK_NORMAL, RISK_REVIEW, RISK_HIGH})

    # the injected spike should actually have been flagged
    assert (scored_df['risk_level'] != RISK_NORMAL).any(), "the injected spike was not flagged by anything"

    # meter summary has one row per meter
    assert len(meter_summary) == 2
    assert set(meter_summary['meter_id']) == {'BR01', 'MH01'}

    # output artifacts actually exist on disk
    assert (output_dir / "anomaly_observations.parquet").exists()
    assert (output_dir / "meter_anomaly_summary.parquet").exists()
    assert (output_dir / "anomaly_run.json").exists()

    # manifest has the fields Part 15 requires
    for key in ('pipeline_version', 'model_name', 'n_meters', 'n_observations_scored', 'evaluation'):
        assert key in manifest

    # no theft language anywhere in the persisted reasons
    saved = pd.read_parquet(output_dir / "anomaly_observations.parquet")
    all_reasons_text = " ".join(saved['reasons'].apply(json.loads).apply(lambda rs: " ".join(rs))).lower()
    assert "theft" not in all_reasons_text
    assert "stealing" not in all_reasons_text
