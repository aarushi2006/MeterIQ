import pandas as pd

from ..schema import REQUIRED_FIELDS, VALID_METER_ID_PREFIXES
from ..config import config
from ..logging_config import get_logger

logger = get_logger("validation")


def validate_required_columns(df):
    """Required columns present at all. This must pass before anything
    else below can run meaningfully."""
    missing = [c for c in REQUIRED_FIELDS if c not in df.columns]
    return len(missing) == 0, missing


def validate_no_missing_essentials(df):
    """No nulls in the required fields."""
    if not df[REQUIRED_FIELDS].notna().all().all():
        null_counts = df[REQUIRED_FIELDS].isnull().sum()
        bad = {c: int(n) for c, n in null_counts.items() if n > 0}
        return False, bad
    return True, {}


def validate_timestamp_ordering(df):
    """Timestamps must be non-decreasing within each meter_id (what
    standardize_dataset()'s sort_values is supposed to guarantee)."""
    is_sorted_per_meter = (
        df.groupby('meter_id')['timestamp']
        .apply(lambda s: s.is_monotonic_increasing)
    )
    bad_meters = is_sorted_per_meter[~is_sorted_per_meter].index.tolist()
    return len(bad_meters) == 0, bad_meters


def validate_no_duplicates(df):
    """No duplicate (meter_id, timestamp) pairs - including across files,
    since this runs on the fully combined dataset."""
    dup_count = int(df.duplicated(subset=['meter_id', 'timestamp']).sum())
    return dup_count == 0, dup_count


def validate_consumption_range(df, max_plausible_kwh_per_interval=None):
    """No implausibly large per-interval consumption. Threshold comes from
    config (Priority 2) rather than being hardcoded."""
    ceiling = (
        config.max_plausible_kwh_per_interval
        if max_plausible_kwh_per_interval is None
        else max_plausible_kwh_per_interval
    )
    over_limit = df[df['consumption'] > ceiling]
    return len(over_limit) == 0, len(over_limit)


def validate_timestamp_validity(df):
    """timestamp column must actually be datetime-typed (not left as
    string/object because to_datetime silently failed somewhere upstream)."""
    is_valid = pd.api.types.is_datetime64_any_dtype(df['timestamp'])
    return is_valid, None if is_valid else str(df['timestamp'].dtype)


def validate_meter_id_validity(df):
    """Every meter_id must start with a known prefix (BR/MH). Anything
    else indicates a malformed or unexpected meter_id that should be
    investigated, not silently processed."""
    prefixes_ok = df['meter_id'].astype(str).str.upper().str.startswith(VALID_METER_ID_PREFIXES)
    bad_ids = df.loc[~prefixes_ok, 'meter_id'].unique().tolist()
    return len(bad_ids) == 0, bad_ids


def validate_region(df):
    """No row should have region == 'Unknown' (add_region() in cleaning.py
    assigns this when a meter_id doesn't match a known prefix - if any
    exist, that's the same underlying problem as
    validate_meter_id_validity(), surfaced from the other side)."""
    if 'region' not in df.columns:
        return True, None  # region hasn't been computed yet - not this check's job
    unknown_count = int((df['region'] == 'Unknown').sum())
    return unknown_count == 0, unknown_count


# ---------------------------------------------------------------------------
# Which failures are allowed to just warn vs. which must stop the pipeline.
# Timestamp ordering and duplicates indicate real data corruption and must
# never be silently repaired - per the brief's explicit instruction - so
# every check here is "critical" (blocking) by default. If a future check
# is added that's genuinely advisory-only, add it to NON_BLOCKING instead
# of quietly changing this function's return contract.
# ---------------------------------------------------------------------------
NON_BLOCKING_CHECKS = set()  # currently empty - everything blocks


def run_all_validations(df):
    """
    THE enforced validation gate (Priority 1 fix). Runs every check below
    and returns (all_critical_passed, report) where report has one entry
    per check with its own pass/fail + detail. pipeline.py must treat
    `all_critical_passed=False` as a hard stop - no ML-ready output is
    written if this fails.
    """
    checks = [
        ('required_columns', validate_required_columns),
        ('no_missing_essentials', validate_no_missing_essentials),
        ('timestamp_validity', validate_timestamp_validity),
        ('meter_id_validity', validate_meter_id_validity),
        ('region_known', validate_region),
        ('no_duplicates', validate_no_duplicates),
        ('consumption_range', validate_consumption_range),
        ('timestamp_ordering', validate_timestamp_ordering),
    ]

    report = {}
    all_critical_passed = True

    for name, fn in checks:
        try:
            ok, detail = fn(df)
        except Exception as exc:  # a check itself crashing is also a failure
            ok, detail = False, f"check raised: {exc!r}"

        report[name] = {'passed': ok, 'detail': detail}
        level = logger.info if ok else logger.error
        level(f"validation[{name}]: {'PASS' if ok else 'FAIL'} ({detail if not ok else ''})")

        if not ok and name not in NON_BLOCKING_CHECKS:
            all_critical_passed = False

    return all_critical_passed, report


# ---------------------------------------------------------------------------
# Backwards-compatible name kept from Phase A - now delegates its first two
# checks + timestamp ordering to the functions above instead of duplicating
# the logic, and its return signature (bool, list[str]) is unchanged so
# nothing that already imports validate_preprocessing breaks.
# ---------------------------------------------------------------------------
def validate_preprocessing(df):
    errors = []

    ok, missing = validate_required_columns(df)
    if not ok:
        errors.extend(f"Missing column: {c}" for c in missing)
        return len(errors) == 0, errors  # can't check further without required columns

    ok, bad = validate_no_missing_essentials(df)
    if not ok:
        errors.append("Contains NaNs in essential columns")
        return len(errors) == 0, errors

    ok, bad_meters = validate_timestamp_ordering(df)
    if not ok:
        errors.append(
            f"{len(bad_meters)} meter(s) not sorted by timestamp: {bad_meters[:10]}"
            + (" ..." if len(bad_meters) > 10 else "")
        )

    return len(errors) == 0, errors
