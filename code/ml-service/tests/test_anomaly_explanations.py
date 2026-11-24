import pandas as pd
import pytest

from ml.anomaly.explainability import add_explanations, to_explanation_record, _reasons_for_row
from ml.config import config


def test_no_deviation_gives_default_reason():
    row = pd.Series({'deviation_z': 0.1, 'pct_change_prev': 0.01,
                      'same_week_deviation_z': 0.1, 'data_quality_flag': False,
                      'isolation_forest_used': False})
    reasons = _reasons_for_row(row)
    assert reasons == ["No significant deviation detected."]


def test_high_deviation_z_produces_specific_reason_with_actual_number():
    row = pd.Series({'deviation_z': 4.2, 'pct_change_prev': 0.01,
                      'same_week_deviation_z': 0.1, 'data_quality_flag': False,
                      'isolation_forest_used': False})
    reasons = _reasons_for_row(row)
    assert any("4.2" in r and "standard deviations" in r for r in reasons)


def test_pct_change_reason_reflects_actual_direction_and_magnitude():
    row = pd.Series({'deviation_z': 0.1, 'pct_change_prev': -1.5,
                      'same_week_deviation_z': 0.1, 'data_quality_flag': False,
                      'isolation_forest_used': False})
    reasons = _reasons_for_row(row)
    assert any("150%" in r and "lower" in r for r in reasons)


def test_same_week_reason_includes_actual_consumption_values():
    row = pd.Series({'deviation_z': 0.1, 'pct_change_prev': 0.01,
                      'same_week_deviation_z': 4.0, 'consumption': 0.05, 'lag_1w': 0.01,
                      'data_quality_flag': False, 'isolation_forest_used': False})
    reasons = _reasons_for_row(row)
    assert any("0.050" in r and "0.010" in r for r in reasons)


def test_data_quality_flag_produces_data_quality_reason_not_behavioral():
    row = pd.Series({'deviation_z': 0.1, 'pct_change_prev': 0.01,
                      'same_week_deviation_z': 0.1, 'data_quality_flag': True,
                      'isolation_forest_used': False})
    reasons = _reasons_for_row(row)
    assert any("data-quality" in r.lower() or "sensor" in r.lower() for r in reasons)


def test_multiple_signals_noted_when_more_than_one_triggers():
    row = pd.Series({'deviation_z': 3.0, 'pct_change_prev': 2.0,
                      'same_week_deviation_z': 0.1, 'data_quality_flag': False,
                      'isolation_forest_used': False})
    reasons = _reasons_for_row(row)
    assert any("independent anomaly indicators" in r for r in reasons)


def test_no_reason_ever_claims_theft():
    """The single most important explainability test in this project."""
    rows = [
        {'deviation_z': 10.0, 'pct_change_prev': 20.0, 'same_week_deviation_z': 10.0,
         'data_quality_flag': True, 'isolation_forest_used': True, 'isolation_forest_severity': 99,
         'consumption': 0.5, 'lag_1w': 0.01},
    ]
    for r in rows:
        reasons = _reasons_for_row(pd.Series(r))
        joined = " ".join(reasons).lower()
        assert "theft" not in joined
        assert "stealing" not in joined
        assert "confirmed" not in joined
        assert "guilty" not in joined


def test_to_explanation_record_shape_matches_spec():
    row = pd.Series({
        'meter_id': 'BR02', 'timestamp': pd.Timestamp('2020-01-01 08:00'),
        'risk_level': 'HIGH_RISK', 'combined_severity': 87.3, 'data_quality_flag': False,
        'reasons': ['Consumption is 3.4 standard deviations above recent baseline.'],
        'deviation_z': 3.4, 'pct_change_prev': 0.1, 'deviation_from_same_hour_last_week': 0.2,
    })
    record = to_explanation_record(row)
    assert record['meter_id'] == 'BR02'
    assert record['risk_level'] == 'HIGH_RISK'
    assert record['anomaly_score'] == 87.3
    assert 'signals' in record and 'deviation_z' in record['signals']
    assert "not a determination of electricity theft" in record['note'].lower()


def test_add_explanations_on_dataframe():
    df = pd.DataFrame({
        'deviation_z': [0.1, 5.0], 'pct_change_prev': [0.01, 0.01],
        'same_week_deviation_z': [0.1, 0.1], 'data_quality_flag': [False, False],
        'isolation_forest_used': [False, False],
    })
    out = add_explanations(df)
    assert out['reasons'].iloc[0] == ["No significant deviation detected."]
    assert out['reasons'].iloc[1] != ["No significant deviation detected."]
