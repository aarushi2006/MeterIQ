import pandas as pd
import pytest


@pytest.fixture
def raw_like_df():
    """
    A tiny synthetic dataframe shaped like one raw CEEW file (before
    standardize_dataset renames it) - 2 meters, a handful of 3-minute
    readings each, deliberately including one duplicate row, one negative
    consumption row, and one all-zero sensor-dropout row.
    """
    rows = [
        # BR01 - normal readings
        {'x_Timestamp': '2020-01-01 00:00:00', 't_kWh': 0.010, 'z_Avg Voltage (Volt)': 230.0,
         'z_Avg Current (Amp)': 0.5, 'y_Freq (Hz)': 50.0, 'meter': 'BR01'},
        {'x_Timestamp': '2020-01-01 00:03:00', 't_kWh': 0.012, 'z_Avg Voltage (Volt)': 231.0,
         'z_Avg Current (Amp)': 0.6, 'y_Freq (Hz)': 50.0, 'meter': 'BR01'},
        # duplicate of the row above (same meter+timestamp, slightly different value)
        {'x_Timestamp': '2020-01-01 00:03:00', 't_kWh': 0.099, 'z_Avg Voltage (Volt)': 231.0,
         'z_Avg Current (Amp)': 0.6, 'y_Freq (Hz)': 50.0, 'meter': 'BR01'},
        # sensor-dropout artifact row (all zero)
        {'x_Timestamp': '2020-01-01 00:06:00', 't_kWh': 0.0, 'z_Avg Voltage (Volt)': 0.0,
         'z_Avg Current (Amp)': 0.0, 'y_Freq (Hz)': 0.0, 'meter': 'BR01'},
        # negative consumption (should be dropped by clean_dataset)
        {'x_Timestamp': '2020-01-01 00:09:00', 't_kWh': -0.5, 'z_Avg Voltage (Volt)': 229.0,
         'z_Avg Current (Amp)': 0.4, 'y_Freq (Hz)': 50.0, 'meter': 'BR01'},
        {'x_Timestamp': '2020-01-01 00:12:00', 't_kWh': 0.015, 'z_Avg Voltage (Volt)': 230.0,
         'z_Avg Current (Amp)': 0.5, 'y_Freq (Hz)': 50.0, 'meter': 'BR01'},

        # MH01 - normal readings, one voltage outlier
        {'x_Timestamp': '2020-01-01 00:00:00', 't_kWh': 0.020, 'z_Avg Voltage (Volt)': 228.0,
         'z_Avg Current (Amp)': 0.7, 'y_Freq (Hz)': 50.0, 'meter': 'MH01'},
        {'x_Timestamp': '2020-01-01 00:03:00', 't_kWh': 0.021, 'z_Avg Voltage (Volt)': 600.0,
         'z_Avg Current (Amp)': 0.7, 'y_Freq (Hz)': 50.0, 'meter': 'MH01'},  # voltage outlier
        {'x_Timestamp': '2020-01-01 00:06:00', 't_kWh': 0.019, 'z_Avg Voltage (Volt)': 229.0,
         'z_Avg Current (Amp)': 0.65, 'y_Freq (Hz)': 50.0, 'meter': 'MH01'},
    ]
    return pd.DataFrame(rows)


@pytest.fixture
def clean_timeseries_df():
    """
    A small, already-standardized, already-sorted single-meter time series
    at the real 3-minute interval, long enough (a bit over a week) to
    exercise lag_1w / rolling_1d without needing millions of rows.
    Consumption follows a simple repeating daily pattern so same-hour
    comparisons are meaningful in tests.
    """
    periods = 24 * 20 * 8  # 8 days at 20 intervals/hour
    ts = pd.date_range('2020-01-01', periods=periods, freq='3min')
    # repeating daily pattern (24h * 20/h = 480-point cycle) plus a tiny
    # deterministic ramp so no two days are bit-for-bit identical
    pattern = [0.01 + 0.01 * ((i % 480) / 480) for i in range(periods)]
    df = pd.DataFrame({
        'meter_id': 'BR01',
        'timestamp': ts,
        'consumption': pattern,
    })
    return df
