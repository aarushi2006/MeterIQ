"""
UC1 diagnostic visualizations (Part 10). These exist to sanity-check
whether the detector behaves reasonably, not for decoration - each one
maps directly to a question in Part 9's evaluation checklist.
"""

import os

import matplotlib
matplotlib.use("Agg")  # headless-safe - no display required
import matplotlib.pyplot as plt

from .scoring import RISK_NORMAL, RISK_REVIEW, RISK_HIGH
from ..config import config
from ..logging_config import get_logger

logger = get_logger("anomaly.visualization")


def plot_meter_timeseries_with_anomalies(meter_df, meter_id, output_dir):
    """Consumption over time for one meter, with REVIEW/HIGH_RISK points highlighted."""
    fig, ax = plt.subplots(figsize=(14, 5))
    ax.plot(meter_df['timestamp'], meter_df['consumption'], color='#94a3b8', linewidth=0.8, label='Consumption')

    review = meter_df[meter_df['risk_level'] == RISK_REVIEW]
    high = meter_df[meter_df['risk_level'] == RISK_HIGH]
    ax.scatter(review['timestamp'], review['consumption'], color='#f59e0b', s=14, label='REVIEW', zorder=3)
    ax.scatter(high['timestamp'], high['consumption'], color='#dc2626', s=18, label='HIGH_RISK', zorder=4)

    ax.set_title(f"Consumption with flagged observations - {meter_id}")
    ax.set_xlabel("Time")
    ax.set_ylabel("Consumption (kWh / 3-min interval)")
    ax.legend()
    fig.tight_layout()

    path = os.path.join(output_dir, f"timeseries_{meter_id}.png")
    fig.savefig(path, dpi=110)
    plt.close(fig)
    return path


def plot_severity_over_time(meter_df, meter_id, output_dir):
    """Combined anomaly severity score over time for one meter."""
    fig, ax = plt.subplots(figsize=(14, 3.5))
    ax.plot(meter_df['timestamp'], meter_df['combined_severity'], color='#2563eb', linewidth=0.8)
    ax.axhline(y=config.risk_review_severity, color='#f59e0b',
               linestyle='--', linewidth=0.8, label='REVIEW threshold')
    ax.axhline(y=config.risk_high_severity, color='#dc2626',
               linestyle='--', linewidth=0.8, label='HIGH_RISK threshold')
    ax.set_title(f"Anomaly severity score over time - {meter_id}")
    ax.set_xlabel("Time")
    ax.set_ylabel("Severity (0-100)")
    ax.legend()
    fig.tight_layout()

    path = os.path.join(output_dir, f"severity_{meter_id}.png")
    fig.savefig(path, dpi=110)
    plt.close(fig)
    return path


def plot_severity_distribution(scored_df, output_dir):
    """Histogram of combined_severity across all scored observations."""
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(scored_df['combined_severity'], bins=60, color='#3b82f6', edgecolor='none')
    ax.set_yscale('log')
    ax.set_title("Distribution of combined anomaly severity scores (log scale)")
    ax.set_xlabel("Severity (0-100)")
    ax.set_ylabel("Count (log scale)")
    fig.tight_layout()

    path = os.path.join(output_dir, "severity_distribution.png")
    fig.savefig(path, dpi=110)
    plt.close(fig)
    return path


def plot_anomaly_counts_per_meter(meter_summary_df, output_dir):
    """Bar chart of anomaly_count per meter, sorted - a fleet-wide overview."""
    df = meter_summary_df.sort_values('anomaly_count', ascending=False)
    fig, ax = plt.subplots(figsize=(14, 5))
    ax.bar(df['meter_id'], df['anomaly_count'], color='#6366f1')
    ax.set_title("Anomaly observation count per meter")
    ax.set_xlabel("Meter")
    ax.set_ylabel("Anomaly count (REVIEW + HIGH_RISK)")
    ax.tick_params(axis='x', rotation=90, labelsize=6)
    fig.tight_layout()

    path = os.path.join(output_dir, "anomaly_counts_per_meter.png")
    fig.savefig(path, dpi=110)
    plt.close(fig)
    return path


def generate_all_plots(scored_df, meter_summary_df, output_dir, example_meter_id=None, example_meter_df=None):
    """
    Generates the full Part-10 plot set. example_meter_id defaults to the
    meter with the highest anomaly_rate in the summary, if not specified -
    a real example rather than an arbitrary one.

    example_meter_df: optional pre-fetched full-detail DataFrame for the
    example meter. When provided (the memory-safe streaming path in
    pipeline.py, where scored_df itself only has narrow columns and can't
    be filtered down to one meter's full detail), this is used directly
    instead of filtering example_meter_id out of scored_df.
    """
    os.makedirs(output_dir, exist_ok=True)
    paths = []

    paths.append(plot_severity_distribution(scored_df, output_dir))
    paths.append(plot_anomaly_counts_per_meter(meter_summary_df, output_dir))

    if example_meter_id is None and len(meter_summary_df) > 0:
        example_meter_id = meter_summary_df.iloc[0]['meter_id']

    if example_meter_df is None and example_meter_id is not None:
        example_meter_df = scored_df[scored_df['meter_id'] == example_meter_id].sort_values('timestamp')

    if example_meter_df is not None and len(example_meter_df) > 0:
        example_meter_df = example_meter_df.sort_values('timestamp')
        paths.append(plot_meter_timeseries_with_anomalies(example_meter_df, example_meter_id, output_dir))
        paths.append(plot_severity_over_time(example_meter_df, example_meter_id, output_dir))

    logger.info(f"Generated {len(paths)} plots in {output_dir}")
    return paths
