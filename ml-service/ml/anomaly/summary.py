"""
UC1 meter-level summary (Part 8). Deliberately uses neutral language
throughout - "anomaly count", "investigation priority" - never "worst
offenders" or similar framing, per the brief's explicit instruction.
"""

import pandas as pd

from .scoring import RISK_NORMAL, RISK_REVIEW, RISK_HIGH


def build_meter_summary(scored_df):
    """
    scored_df: the full scored dataset (output of run_scoring()), with at
    least meter_id, region, risk_level, combined_severity, reasons.

    Returns one row per meter with counts, rates, and the most common
    anomaly reasons for that meter - the input to the dashboard's
    per-meter investigation view.
    """
    rows = []

    for meter_id, group in scored_df.groupby('meter_id'):
        total = len(group)
        normal_count = int((group['risk_level'] == RISK_NORMAL).sum())
        review_count = int((group['risk_level'] == RISK_REVIEW).sum())
        high_count = int((group['risk_level'] == RISK_HIGH).sum())
        anomaly_count = review_count + high_count

        reason_counts = {}
        if 'reasons' in group.columns:
            flagged = group[group['risk_level'] != RISK_NORMAL]
            for reason_list in flagged['reasons']:
                for r in (reason_list or []):
                    reason_counts[r] = reason_counts.get(r, 0) + 1
        top_reasons = sorted(reason_counts.items(), key=lambda kv: -kv[1])[:3]

        rows.append({
            'meter_id': meter_id,
            'region': group['region'].iloc[0] if 'region' in group.columns else None,
            'total_observations': total,
            'normal_count': normal_count,
            'review_count': review_count,
            'high_risk_count': high_count,
            'anomaly_count': anomaly_count,
            'anomaly_rate': round(anomaly_count / total, 4) if total else 0.0,
            'max_severity': round(float(group['combined_severity'].max()), 2) if total else 0.0,
            'mean_severity': round(float(group['combined_severity'].mean()), 2) if total else 0.0,
            'data_quality_flag_count': int(group.get('data_quality_flag', pd.Series(dtype=bool)).sum()),
            'most_common_reasons': [r for r, _ in top_reasons],
        })

    summary = pd.DataFrame(rows).sort_values('anomaly_rate', ascending=False).reset_index(drop=True)
    return summary
