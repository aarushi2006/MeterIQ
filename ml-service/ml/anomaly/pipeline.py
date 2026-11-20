"""
UC1 pipeline: reads Phase A.5's feature Parquet output, runs the
statistical baseline and (where enough history exists) Isolation Forest
per meter, combines them into a risk level with explanations, and writes
the outputs described in Part 15.

Run as a module:

    cd backend
    python -m ml.anomaly.pipeline --sample-meters BR02 MH01
    python -m ml.anomaly.pipeline                       # full run, all meters
    python -m ml.anomaly.pipeline --no-isolation-forest  # baseline only
"""

import argparse
import json
import os
import time
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from ..config import config
from ..logging_config import setup_logging, get_logger
from .baseline import run_baseline
from .isolation_forest import fit_and_score_meter
from .scoring import run_scoring
from .explainability import add_explanations
from .summary import build_meter_summary
from .visualization import generate_all_plots
from ..evaluation.anomaly_evaluation import run_full_evaluation

logger = get_logger("anomaly.pipeline")

DEFAULT_FEATURES_PATH_GLOB = "data/cache/features_*.parquet"


def _find_latest_features_parquet():
    import glob
    matches = sorted(glob.glob(DEFAULT_FEATURES_PATH_GLOB), key=os.path.getmtime, reverse=True)
    if not matches:
        raise FileNotFoundError(
            f"No Phase A.5 feature output found matching {DEFAULT_FEATURES_PATH_GLOB}. "
            "Run `python -m ml.pipeline` first."
        )
    return matches[0]


def _process_one_meter(meter_df, use_isolation_forest):
    """
    Runs baseline -> (optional) Isolation Forest -> combined scoring for
    one meter's data. Isolation Forest only scores the held-out later
    portion of the meter's history (chronological split - see
    isolation_forest.py), so its output is merged back onto that subset
    of rows only; earlier (training-portion) rows get baseline-only
    scoring, which is the documented, correct behavior for rows the
    anomaly model was never meant to score.
    """
    meter_df = meter_df.sort_values('timestamp').reset_index(drop=True)
    baselined = run_baseline(meter_df)
    baselined['isolation_forest_used'] = False

    if use_isolation_forest:
        if_result = fit_and_score_meter(meter_df)
        if if_result is not None:
            baselined = baselined.merge(
                if_result[['timestamp', 'isolation_forest_severity']],
                on='timestamp', how='left',
            )
            # Only rows the held-out model actually scored are marked as
            # using the model. Training-portion rows stay baseline-only,
            # and meters below the reliability floor never set this flag.
            baselined['isolation_forest_used'] = baselined[
                'isolation_forest_severity'
            ].notna()
        else:
            baselined['isolation_forest_severity'] = np.nan

    scored = run_scoring(baselined)

    # Explanations are row-wise (pandas .apply) and not worth computing
    # for every NORMAL row at full scale - only flagged rows get them.
    from .scoring import RISK_NORMAL
    flagged_mask = scored['risk_level'] != RISK_NORMAL
    scored['reasons'] = [[] for _ in range(len(scored))]
    if flagged_mask.any():
        explained = add_explanations(scored[flagged_mask])
        scored.loc[flagged_mask, 'reasons'] = explained['reasons']
    scored.loc[~flagged_mask, 'reasons'] = scored.loc[~flagged_mask, 'reasons'].apply(
        lambda _: ["No significant deviation detected."]
    )

    return scored


def run_uc1_pipeline(features_path=None, sample_meters=None, use_isolation_forest=True,
                      output_dir=None, generate_plots=True):
    """
    sample_meters: small in-memory path (holds all scored rows in memory
    - fine for a handful of meters, used for dev/testing).
    Full run (sample_meters=None): STREAMS each meter's scored rows
    straight to the output Parquet via pyarrow, one meter at a time -
    same reasoning as Phase A.5's load_and_clean_all() streaming path:
    holding a list of 84 meters' full observation-level DataFrames and
    concatenating at the end would double peak memory for no reason, and
    this dataset (19.6M rows x ~45 columns after scoring) is large enough
    for that to matter. Only the small per-meter summary rows are
    accumulated in memory across the full run.
    """
    t0 = time.time()
    output_dir = output_dir or os.path.join(config.output_dir, "anomaly")
    os.makedirs(output_dir, exist_ok=True)
    plots_dir = os.path.join(output_dir, "plots")

    features_path = features_path or _find_latest_features_parquet()
    logger.info(f"UC1 pipeline starting - reading features from {features_path}")

    if sample_meters:
        meter_ids = list(sample_meters)
        logger.info(f"sample_meters active: {meter_ids} - using in-memory path")
    else:
        meter_ids = pd.read_parquet(features_path, columns=['meter_id'])['meter_id'].unique().tolist()
        logger.info(f"Full run: {len(meter_ids)} meters - using streaming path")

    streaming = not bool(sample_meters)

    import pyarrow as pa
    import pyarrow.parquet as pq

    obs_path = os.path.join(output_dir, "anomaly_observations.parquet")
    writer = None
    scored_frames = []  # only populated in the small in-memory (sample) path
    summary_rows_accum = []  # small per-meter aggregates, safe to accumulate either way
    n_isolation_forest_used = 0
    n_total_scored = 0

    for i, meter_id in enumerate(meter_ids):
        try:
            meter_df = pd.read_parquet(features_path, filters=[('meter_id', 'in', [meter_id])])
        except Exception:
            full = pd.read_parquet(features_path)
            meter_df = full[full['meter_id'] == meter_id]

        if len(meter_df) == 0:
            logger.warning(f"Meter {meter_id} not found in {features_path}, skipping")
            continue

        scored = _process_one_meter(meter_df, use_isolation_forest)
        if scored['isolation_forest_used'].any():
            n_isolation_forest_used += 1
        n_total_scored += len(scored)

        # per-meter summary needs the full scored frame, but only for
        # THIS meter - cheap regardless of path
        meter_summary_row = build_meter_summary(scored)
        summary_rows_accum.append(meter_summary_row)

        if streaming:
            save_chunk = scored.copy()
            save_chunk['reasons'] = save_chunk['reasons'].apply(json.dumps)
            table = pa.Table.from_pandas(save_chunk, preserve_index=False)
            if writer is None:
                writer = pq.ParquetWriter(obs_path, table.schema)
            writer.write_table(table)
            del save_chunk, table
        else:
            scored_frames.append(scored)

        logger.info(f"[{i + 1}/{len(meter_ids)}] {meter_id}: {len(scored):,} rows scored, "
                    f"{(scored['risk_level'] != 'NORMAL').sum()} flagged")

        del scored, meter_df
        import gc
        gc.collect()

    if writer is not None:
        writer.close()

    if n_total_scored == 0:
        raise ValueError("No meters were scored - check meter_ids / features_path")

    meter_summary = pd.concat(summary_rows_accum, ignore_index=True).sort_values(
        'anomaly_rate', ascending=False
    ).reset_index(drop=True)

    # Evaluation runs on narrow columns READ BACK FROM THE JUST-WRITTEN
    # PARQUET (streaming path) rather than accumulated in memory during
    # the loop - an earlier version of this accumulated a per-meter list
    # of narrow-but-full-length DataFrames across all 84 meters and was
    # OOM-killed at ~3.93GB (confirmed via dmesg) during exactly this
    # step, right after the streaming loop itself had already completed
    # successfully. Reading back from disk (like Phase A.5's
    # load_and_clean_all -> validation narrow-column read) avoids ever
    # holding two full-length copies of the same data at once.
    if streaming:
        eval_df = pd.read_parquet(obs_path, columns=[
            'meter_id', 'region', 'combined_severity', 'risk_level', 'hour', 'day_of_week',
            'data_quality_flag', 'baseline_severity', 'isolation_forest_severity',
        ])
        evaluation_results = run_full_evaluation(eval_df, meter_summary)

        # A/B/C component comparison (Issue 4), computed on the FULL
        # dataset now that it's available narrowly - not just the
        # 17-meter sample used during development/calibration.
        def _rates(sev):
            sev = sev.dropna()
            total = len(sev)
            if total == 0:
                return {'review_rate': None, 'high_risk_rate': None, 'total_flagged_rate': None}
            review = float(((sev >= config.risk_review_severity) & (sev < config.risk_high_severity)).mean())
            high = float((sev >= config.risk_high_severity).mean())
            return {'review_rate': round(review, 4), 'high_risk_rate': round(high, 4),
                    'total_flagged_rate': round(review + high, 4)}

        component_comparison = {
            'note': (
                'Rates below use the SAME risk_review_severity/risk_high_severity thresholds for '
                'all three rows for comparability, even though isolation_forest_severity alone is on '
                'a percentile scale for which those thresholds are not the properly-calibrated ones '
                '(see isolation_forest_review_percentile/isolation_forest_high_percentile for the '
                'thresholds actually used when combining). This row exists to show why combining '
                'was necessary, not as a recommended standalone configuration.'
            ),
            'baseline_only': _rates(eval_df['baseline_severity']),
            'isolation_forest_only_raw_percentile': _rates(eval_df['isolation_forest_severity']),
            'combined_fixed': _rates(eval_df['combined_severity']),
        }
        del eval_df['baseline_severity'], eval_df['isolation_forest_severity']

        # Qualitative top-10 spot-check: identify the top-10 rows from the
        # already-loaded narrow eval_df (cheap - no 'reasons'/'consumption'
        # columns needed for this step), then fetch ONLY those specific
        # meters' full detail via the same per-meter filtered read used in
        # the main loop, instead of re-reading all ~45 columns x 19.6M
        # rows a second time. An earlier version of this function DID
        # re-read the full dataset (with the 'reasons' JSON-string column)
        # here and was OOM-killed at ~3.93GB, twice, confirmed via dmesg -
        # even after the loop itself was already fixed to be memory-flat.
        # This version never holds more than a handful of meters' full
        # detail in memory at once, matching every other memory-safe stage
        # in this pipeline.
        top10_narrow = eval_df.nlargest(10, 'combined_severity')
        top10_meters = top10_narrow['meter_id'].unique().tolist()
        candidates = pd.read_parquet(obs_path, columns=[
            'meter_id', 'timestamp', 'consumption', 'combined_severity',
            'risk_level', 'data_quality_flag', 'reasons',
        ], filters=[('meter_id', 'in', top10_meters)])
        top10_full = candidates.nlargest(10, 'combined_severity').copy()
        top10_full['reasons'] = top10_full['reasons'].apply(json.loads)
        evaluation_results['qualitative_spot_check_top10'] = top10_full.to_dict(orient='records')
        del candidates, top10_narrow, top10_full

        # Plotting: the severity distribution and per-meter bar chart only
        # need the narrow eval_df already in memory; only the one example
        # meter's full timeseries needs a (small, single-meter) detail
        # read - never the full dataset.
        example_meter_id = meter_summary.iloc[0]['meter_id'] if len(meter_summary) > 0 else None
        example_meter_df = None
        if example_meter_id is not None:
            example_meter_df = pd.read_parquet(obs_path, filters=[('meter_id', 'in', [example_meter_id])])
            example_meter_df['reasons'] = example_meter_df['reasons'].apply(json.loads)

        scored_df_for_plots = eval_df  # used for severity distribution only (has combined_severity)
        del eval_df
    else:
        scored_df_for_plots = pd.concat(scored_frames, ignore_index=True)
        evaluation_results = run_full_evaluation(scored_df_for_plots, meter_summary)
        save_df = scored_df_for_plots.copy()
        save_df['reasons'] = save_df['reasons'].apply(json.dumps)
        save_df.to_parquet(obs_path, index=False)
        del save_df

        def _rates(sev):
            sev = sev.dropna()
            total = len(sev)
            if total == 0:
                return {'review_rate': None, 'high_risk_rate': None, 'total_flagged_rate': None}
            review = float(((sev >= config.risk_review_severity) & (sev < config.risk_high_severity)).mean())
            high = float((sev >= config.risk_high_severity).mean())
            return {'review_rate': round(review, 4), 'high_risk_rate': round(high, 4),
                    'total_flagged_rate': round(review + high, 4)}

        component_comparison = {
            'baseline_only': _rates(scored_df_for_plots['baseline_severity']),
            'isolation_forest_only_raw_percentile': _rates(
                scored_df_for_plots.get('isolation_forest_severity', pd.Series(dtype=float))
            ),
            'combined_fixed': _rates(scored_df_for_plots['combined_severity']),
        }

    summary_path = os.path.join(output_dir, "meter_anomaly_summary.parquet")
    meter_summary_to_save = meter_summary.copy()
    meter_summary_to_save['most_common_reasons'] = meter_summary_to_save['most_common_reasons'].apply(json.dumps)
    meter_summary_to_save.to_parquet(summary_path, index=False)

    plot_paths = []
    if generate_plots:
        if streaming:
            plot_paths = generate_all_plots(
                scored_df_for_plots, meter_summary, plots_dir,
                example_meter_id=example_meter_id, example_meter_df=example_meter_df,
            )
        else:
            plot_paths = generate_all_plots(scored_df_for_plots, meter_summary, plots_dir)

    elapsed = time.time() - t0

    manifest = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'pipeline_version': config.pipeline_version,
        'uc1_version': 'phase-b.1-v2',
        'features_path': features_path,
        'model_name': 'statistical_baseline + isolation_forest' if use_isolation_forest else 'statistical_baseline',
        'scoring_methodology': (
            'baseline_severity: max of three per-meter-normalized signal strengths '
            '(deviation_z, pct_change_prev, same-week deviation / rolling_std_1d), each clipped '
            'via its own review/high threshold. isolation_forest_severity: percentile rank of the '
            'raw anomaly score against that meter\'s OWN TRAINING-SET score distribution (not the '
            'scoring window) - fixed in Phase B.1 from an earlier per-window min-max scaling that '
            'forced every scoring window to span 0-100 regardless of actual anomalousness. '
            'combined_severity: max(baseline_strength, isolation_forest_strength), where each '
            'component is converted to a 0-1 strength using ITS OWN thresholds before combining '
            '(isolation_forest_review_percentile=90/isolation_forest_high_percentile=97 for IF, '
            'since its percentile scale is not comparable to baseline\'s 0-100 scale) - this '
            'combination-level fix was also added in Phase B.1 after the naive shared-threshold '
            'combination produced an 83% flag rate from Isolation Forest alone on real data.'
        ),
        'isolation_forest_params': {
            'n_estimators': config.isolation_forest_n_estimators,
            'contamination': config.isolation_forest_contamination,
            'random_seed': config.random_seed,
            'train_fraction': config.anomaly_train_fraction,
            'min_observations_per_meter': config.min_observations_per_meter,
            'severity_review_percentile': config.isolation_forest_review_percentile,
            'severity_high_percentile': config.isolation_forest_high_percentile,
        } if use_isolation_forest else None,
        'risk_thresholds': {
            'review_severity': config.risk_review_severity,
            'high_severity': config.risk_high_severity,
        },
        'n_meters': len(meter_ids),
        'n_meters_with_isolation_forest': n_isolation_forest_used,
        'n_observations_scored': n_total_scored,
        'evaluation': evaluation_results,
        'component_comparison': component_comparison,
        'elapsed_seconds': round(elapsed, 2),
        'peak_memory_note': (
            'Not self-measured inside this function - see README.md\'s "Full-scale benchmark" '
            'section for the externally-measured resource.getrusage() peak RSS for the run this '
            'manifest describes, to avoid this file claiming an unmeasured number.'
        ),
        'output_files': {
            'anomaly_observations': obs_path,
            'meter_anomaly_summary': summary_path,
            'plots': plot_paths,
        },
    }
    manifest_path = os.path.join(output_dir, "anomaly_run.json")
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2, default=str)

    logger.info(f"UC1 pipeline finished in {elapsed:.1f}s. Manifest: {manifest_path}")
    return scored_df_for_plots, meter_summary, manifest


def _parse_args():
    p = argparse.ArgumentParser(description="MeterIQ UC1 anomaly detection pipeline")
    p.add_argument("--features-path", default=None)
    p.add_argument("--sample-meters", nargs="*", default=None)
    p.add_argument("--no-isolation-forest", action="store_true")
    p.add_argument("--no-plots", action="store_true")
    p.add_argument("--output-dir", default=None)
    p.add_argument("--log-level", default=None)
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    setup_logging(args.log_level or config.log_level, config.log_dir)
    run_uc1_pipeline(
        features_path=args.features_path,
        sample_meters=args.sample_meters,
        use_isolation_forest=not args.no_isolation_forest,
        output_dir=args.output_dir,
        generate_plots=not args.no_plots,
    )
