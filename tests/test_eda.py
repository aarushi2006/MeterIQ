import json

import pandas as pd

from meteriq.eda import discover_files, profile_dataset, read_dataset, write_profile


def test_profile_reports_observed_quality_information():
    frame = pd.DataFrame(
        {
            "meter_code": ["A-1", "A-1", "A-2", "A-2"],
            "reading_time": ["2026-01-01 00:00", "2026-01-01 01:00", "2026-01-01 00:00", None],
            "energy_kwh": [1.2, -1.0, 0.0, 42.0],
        }
    )

    profile = profile_dataset(frame, "Mathura")

    assert profile["rows"] == 4
    assert "meter_code" in profile["candidate_columns"]["meter_or_customer_identifier"]
    assert "reading_time" in profile["candidate_columns"]["timestamp_or_date"]
    assert profile["column_profiles"]["energy_kwh"]["numeric"]["negative_values"] == 1
    assert profile["missing_values"]["reading_time"] == 1


def test_csv_read_discovery_and_json_report(tmp_path):
    dataset = tmp_path / "bareilly.csv"
    dataset.write_text("meter,load\nM1,2.5\n", encoding="utf-8")

    assert discover_files(tmp_path) == [dataset]
    assert read_dataset(dataset).shape == (1, 2)
    output = write_profile(profile_dataset(read_dataset(dataset)), tmp_path / "report.json")
    assert json.loads(output.read_text(encoding="utf-8"))["rows"] == 1
