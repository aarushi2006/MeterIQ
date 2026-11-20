"""
UC1 explainability. Every reason string is generated from the actual
values on that row - never a generic template unrelated to the
observation (Part 7's explicit requirement).

Language is deliberately restricted to risk/investigation framing
throughout this module - see the REASON_* templates below. None of them
claim theft; all of them describe a measurable deviation and, where
relevant, note that it's a screening signal, not a finding.
"""

from ..config import config


def _reasons_for_row(row):
    reasons = []

    if row.get('data_quality_flag'):
        reasons.append(
            "Voltage reading is outside the configured plausible range - this may indicate a "
            "data-quality/sensor issue rather than a genuine consumption anomaly."
        )

    dz = row.get('deviation_z')
    if dz is not None and abs(dz) >= config.deviation_z_review_threshold:
        direction = "above" if dz > 0 else "below"
        reasons.append(
            f"Consumption is {abs(dz):.1f} standard deviations {direction} the meter's recent "
            f"(24-hour) baseline."
        )

    pct = row.get('pct_change_prev')
    if pct is not None and abs(pct) >= config.pct_change_review_threshold:
        direction = "higher" if pct > 0 else "lower"
        reasons.append(
            f"Consumption changed {abs(pct) * 100:.0f}% {direction} than the immediately "
            f"preceding reading."
        )

    week_z = row.get('same_week_deviation_z')
    if week_z is not None and abs(week_z) >= config.same_week_deviation_review_threshold:
        actual = row.get('consumption')
        last_week = row.get('lag_1w')
        if actual is not None and last_week is not None:
            direction = "higher" if actual > last_week else "lower"
            reasons.append(
                f"Consumption is substantially {direction} than the same time last week "
                f"({actual:.3f} kWh vs {last_week:.3f} kWh), {abs(week_z):.1f}x the meter's "
                f"usual week-to-week variability."
            )
        else:
            reasons.append("Consumption differs substantially from the historical same-hour pattern.")

    if (
        row.get('isolation_forest_used')
        and row.get('isolation_forest_severity', 0)
        >= config.isolation_forest_review_percentile
    ):
        reasons.append(
            "The learned anomaly model also flagged this observation as unusual relative to this "
            "meter's own recent behavior pattern."
        )

    n_signals = sum([
        dz is not None and abs(dz) >= config.deviation_z_review_threshold,
        pct is not None and abs(pct) >= config.pct_change_review_threshold,
        week_z is not None and abs(week_z) >= config.same_week_deviation_review_threshold,
    ])
    if n_signals >= 2:
        reasons.append(f"{n_signals} independent anomaly indicators triggered simultaneously.")

    if not reasons:
        reasons.append("No significant deviation detected.")

    return reasons


def add_explanations(df):
    """
    Adds a `reasons` column (list of strings per row) built from that
    row's own feature values. Intended to be called only on rows that
    will actually be surfaced (REVIEW/HIGH_RISK) for performance, but
    safe to call on the full dataset - a NORMAL row just gets
    ["No significant deviation detected."].
    """
    df = df.copy()
    df['reasons'] = df.apply(_reasons_for_row, axis=1)
    return df


def to_explanation_record(row):
    """
    Builds the structured explanation dict shape described in the brief
    (Part 7), ready to be returned by a future FastAPI endpoint without
    modification.
    """
    return {
        "meter_id": row.get("meter_id"),
        "timestamp": str(row.get("timestamp")),
        "risk_level": row.get("risk_level"),
        "anomaly_score": None if row.get("combined_severity") is None else round(float(row["combined_severity"]), 2),
        "data_quality_flag": bool(row.get("data_quality_flag", False)),
        "reasons": row.get("reasons", []),
        "signals": {
            "deviation_z": None if row.get("deviation_z") is None else round(float(row["deviation_z"]), 3),
            "pct_change_prev": None if row.get("pct_change_prev") is None else round(float(row["pct_change_prev"]), 3),
            "deviation_from_same_hour_last_week": (
                None if row.get("deviation_from_same_hour_last_week") is None
                else round(float(row["deviation_from_same_hour_last_week"]), 4)
            ),
        },
        "note": "Anomaly/risk screening signal for human investigation - not a determination of electricity theft.",
    }
