import numpy as np
import pandas as pd

"""
IMPORTANT - READ BEFORE USING THIS MODULE
==========================================
This file does NOT contain real weather data. The CEEW dataset has no
weather columns, and this sandbox has no access to a weather API or
historical meteorological records for Mathura/Bareilly.

What this provides instead is a synthetic seasonal temperature CLIMATOLOGY
PROXY: a smooth curve approximating the typical North-India annual
temperature cycle (hot pre-monsoon summers, cooler winters), driven only
by day-of-year. It captures the general seasonal shape that plausibly
correlates with load (AC/cooler use in summer, heater use in winter) well
enough to be a placeholder feature during prototyping.

It is deliberately NOT hour-of-day resolved, NOT randomly perturbed to
look more "realistic," and NOT labeled with real dates pretending to be
actual recorded highs/lows for a specific day - that would risk being
mistaken for real data later. If this project moves toward production or
any claim about actual model accuracy against real conditions, REPLACE
this module with real historical weather (e.g. IMD station data or a
weather API's historical endpoint for Mathura/Bareilly) before drawing
any conclusions that depend on it.

Use `add_weather_proxy_features(df)` only as a placeholder to unblock
feature-engineering/UI development - never cite its output as a measured
temperature.
"""

# Very rough seasonal reference points for North India (Uttar Pradesh),
# in degrees Celsius, used only to shape the synthetic curve below:
# ~ coldest in Jan, hottest in May/June (pre-monsoon), cooling through the
# monsoon and into winter. These are approximate seasonal characterizations,
# not measured records.
APPROX_MONTHLY_MEAN_C = {
    1: 13, 2: 17, 3: 24, 4: 31, 5: 36, 6: 35,
    7: 31, 8: 30, 9: 30, 10: 27, 11: 20, 12: 14,
}


def synthetic_seasonal_temperature(timestamp_series):
    """
    Returns a synthetic, smooth proxy temperature (deg C) for each
    timestamp, interpolated between the approximate monthly means above.
    Clearly a proxy - see module docstring.
    """
    month = timestamp_series.dt.month
    day_frac = (timestamp_series.dt.day - 1) / timestamp_series.dt.days_in_month

    next_month = (month % 12) + 1
    this_mean = month.map(APPROX_MONTHLY_MEAN_C)
    next_mean = next_month.map(APPROX_MONTHLY_MEAN_C)

    return this_mean + (next_mean - this_mean) * day_frac


def add_weather_proxy_features(df, timestamp_col='timestamp'):
    """
    Adds `temp_proxy_c` (synthetic seasonal temperature) and
    `is_extreme_temp_proxy` (1 if the proxy value is in a rough
    "AC-load" or "heater-load" range) to the dataframe.

    Column names are deliberately suffixed `_proxy` throughout so a
    downstream consumer (dashboard, model card, API response) can never
    mistake this for a real weather feed without renaming it first.
    """
    df = df.copy()
    df['temp_proxy_c'] = synthetic_seasonal_temperature(df[timestamp_col]).astype('float32')
    df['is_extreme_temp_proxy'] = (
        (df['temp_proxy_c'] >= 35) | (df['temp_proxy_c'] <= 10)
    ).astype(int)
    return df
