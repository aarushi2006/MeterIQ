import os
import pandas as pd
import pytest

from ml.preprocessing.cleaning import load_and_clean_all
from ml.preprocessing.validation import run_all_validations
from ml.features.feature_engineering import build_features
from ml.features.calendar_features import add_calendar_features
from ml.features.weather_proxy import add_weather_proxy_features
import ml.pipeline as pipeline_module


def _write_small_raw_csv(path):
    rows = []
    ts0 = pd.Timestamp('2020-01-01 00:00:00')
    for i in range(50):
        rows.append({
            'x_Timestamp': ts0 + pd.Timedelta(minutes=3 * i),
            't_kWh': 0.01 + 0.001 * i,
            'z_Avg Voltage (Volt)': 230.0,
            'z_Avg Current (Amp)': 0.5,
            'y_Freq (Hz)': 50.0,
            'meter': 'BR01',
        })
    pd.DataFrame(rows).to_csv(path, index=False)


def test_end_to_end_small_sample_cleaning_validation_features_output(tmp_path):
    """
    The required end-to-end test: small raw sample -> cleaning ->
    validation -> features -> output. Uses a tiny on-disk CSV shaped
    exactly like a real raw CEEW file, not the full dataset.
    """
    raw_path = tmp_path / "tiny_raw.csv"
    _write_small_raw_csv(raw_path)

    # --- cleaning ---
    df, report = load_and_clean_all(str(tmp_path), filenames=["tiny_raw.csv"])
    assert report["tiny_raw.csv"]["status"] == "ok"
    assert len(df) == 50  # nothing should be dropped from this clean sample
    assert set(['meter_id', 'timestamp', 'consumption', 'region']).issubset(df.columns)

    # --- validation ---
    all_ok, validation_report = run_all_validations(df)
    assert all_ok, validation_report

    # --- features ---
    featured = build_features(df)
    featured = add_calendar_features(featured)
    featured = add_weather_proxy_features(featured)
    assert 'lag_1_interval' in featured.columns
    assert 'is_holiday' in featured.columns
    assert 'temp_proxy_c' in featured.columns

    # --- output ---
    out_path = tmp_path / "output.parquet"
    featured.to_parquet(out_path, index=False)
    assert out_path.exists()

    reloaded = pd.read_parquet(out_path)
    assert len(reloaded) == len(featured)


def test_pipeline_stops_on_validation_failure(monkeypatch, tmp_path):
    """
    Direct regression test for the audit's CRITICAL finding, at the
    pipeline.py level (not just validation.py in isolation): if the
    cleaned data fails validation (here: an injected duplicate
    meter_id+timestamp pair), run_phase_a() must raise and must NOT reach
    feature engineering or write any output.
    """
    corrupted = pd.DataFrame({
        'meter_id': ['BR01', 'BR01'],
        'timestamp': pd.to_datetime(['2020-01-01 00:00', '2020-01-01 00:00']),  # duplicate on purpose
        'consumption': [0.01, 0.02],
        'region': ['Bareilly', 'Bareilly'],
    })

    def fake_load_and_clean_all(data_dir, filenames=None, **kwargs):
        return corrupted.copy(), {'fake_file.csv': {'status': 'ok'}}

    monkeypatch.setattr(pipeline_module, "load_and_clean_all", fake_load_and_clean_all)
    monkeypatch.setattr(pipeline_module.config, "output_dir", str(tmp_path / "output"))
    monkeypatch.setattr(pipeline_module.config, "cache_dir", str(tmp_path / "cache"))

    with pytest.raises(ValueError):
        pipeline_module.run_phase_a(data_dir=str(tmp_path), sample_meters=['BR01'])

    # No feature/output parquet should have been written anywhere under tmp_path
    written_parquets = list(tmp_path.rglob("*.parquet"))
    assert written_parquets == []
