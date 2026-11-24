import pandas as pd

# Verified holiday dates for 2019-2021 (the CEEW dataset's coverage window),
# for Uttar Pradesh, where both Mathura and Bareilly are located. These are
# real, looked-up dates (via web search against multiple sources at the
# time this was written) - NOT generated/approximated. This list covers
# the major national holidays plus the two festivals with the clearest
# expected effect on household electricity consumption (Diwali - lighting
# load; Holi). It is NOT an exhaustive list of every regional/religious UP
# holiday (e.g. minor observances, Eid dates for years other than 2019 were
# not individually re-verified) - documented here rather than silently
# implied to be complete.
KNOWN_HOLIDAYS = {
    # National holidays (fixed dates every year)
    '2019-01-26': 'Republic Day',
    '2019-08-15': 'Independence Day',
    '2019-10-02': 'Gandhi Jayanti',
    '2020-01-26': 'Republic Day',
    '2020-08-15': 'Independence Day',
    '2020-10-02': 'Gandhi Jayanti',
    '2021-01-26': 'Republic Day',
    '2021-08-15': 'Independence Day',
    '2021-10-02': 'Gandhi Jayanti',

    # Diwali (Festival of Lights) - directly relevant to consumption:
    # elevated evening lighting load is expected around this date.
    '2019-10-27': 'Diwali',
    '2020-11-14': 'Diwali',
    '2021-11-04': 'Diwali',

    # Holi - verified main celebration dates (day colours are played).
    '2019-03-21': 'Holi',
    '2020-03-10': 'Holi',
    '2021-03-29': 'Holi',

    # Eid al-Fitr / Eid al-Adha, 2019 only (verified); 2020/2021 dates were
    # not independently re-verified for this pass and are intentionally
    # left out rather than guessed.
    '2019-06-05': 'Eid al-Fitr',
    '2019-08-12': 'Eid al-Adha',
}


def add_calendar_features(df, timestamp_col='timestamp'):
    """
    Adds `is_holiday` (0/1) and `holiday_name` (or None) based on the
    KNOWN_HOLIDAYS table above. Matches on date only (a holiday applies to
    every reading that day, regardless of time-of-day).

    This is real calendar data, not a synthetic/generated feature - but its
    coverage is intentionally partial (see the module docstring above), so
    treat `is_holiday == 0` as "not a holiday we have on file" rather than
    a guarantee.
    """
    df = df.copy()
    dates = df[timestamp_col].dt.strftime('%Y-%m-%d')

    df['is_holiday'] = dates.isin(KNOWN_HOLIDAYS.keys()).astype(int)
    df['holiday_name'] = dates.map(KNOWN_HOLIDAYS)

    return df
