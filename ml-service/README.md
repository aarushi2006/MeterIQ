# MeterIQ — ML Pipeline Notes (historical + current service)

> **Current layout:** the pipeline code lives in `ml-service/ml/`, the FastAPI
> entry point is `ml-service/main.py`, and startup/configuration instructions
> are in the repository root `README.md`. Paths in the historical sections
> below that say `backend/` refer to the original standalone ML package before
> it was moved under `ml-service/`. The methodological notes, test counts, and
> benchmark numbers are retained as the record of the anomaly pipeline.
>
> The forecasting pipeline (UC2) was rewritten to run against the Phase A
> feature cache and the real 3-minute sampling cadence; it now produces
> `data/output/forecasting/forecast_predictions.parquet` and
> `forecast_report.json`. See the root `README.md` for regeneration commands
> and measured run times.

This covers **Phase A** (cleaning, validation, feature engineering),
**Phase A.5** (hardening), and **Phase B / UC1** (anomaly/investigation-risk
screening, statistical baseline + Isolation Forest). It does **not**
include UC2 (forecasting), real weather, or the FastAPI backend —
those are later phases, intentionally not started yet.

## Project structure

```
backend/
  ml/
    config.py            <- central config (paths, sampling interval, policy, seed)
    schema.py             <- data contract: raw->normalized column mapping, required fields
    logging_config.py     <- structured logging setup
    cache.py              <- content-hash Parquet caching for the two expensive stages
    pipeline.py            <- orchestrates everything, runnable via `python -m ml.pipeline`
    preprocessing/
      cleaning.py         <- standardize/clean/region/dropout/voltage + streaming write path
      validation.py       <- 8 enforced validation checks (was 1 of 3 enforced before A.5)
    features/
      feature_engineering.py  <- time/lag/rolling/change features + sorted-input contract
      calendar_features.py    <- real, verified 2019-2021 UP holiday dates
      weather_proxy.py        <- SYNTHETIC seasonal proxy - explicitly not real weather
    eda/
      eda.py               <- plotting functions (unchanged from the original upload)
  tests/                   <- 44 pytest tests, synthetic data only
  data/
    cache/                 <- generated Parquet cache (gitignored - regenerate, don't commit)
    output/pipeline_run.json  <- run manifest, written on every successful run
  logs/pipeline.log
  requirements.txt
  pytest.ini
```

Place the 6 raw CEEW CSVs directly in `backend/data/` (not included here —
you already have them, ~1GB).

## How to run

```bash
cd backend
pip install -r requirements.txt --break-system-packages

# Full pipeline (default: all 84 meters, batch_size=5)
python -m ml.pipeline

# Small sample for quick iteration
python -m ml.pipeline --sample-meters BR02 BR05 MH01

# Force recompute, bypassing the cache
python -m ml.pipeline --force-recompute

# Run the tests (fast - all synthetic data, no CSVs needed)
python -m pytest -v
```

No `sys.path` manipulation needed anywhere — `ml/` is a proper package,
run with `-m` (Priority 11).

## Data contract (schema.py)

Required after cleaning: `meter_id` (string), `timestamp` (datetime64),
`consumption` (float32, kWh per 3-minute interval). Optional (present on
raw 3-min files, absent on daily aggregates): `average_voltage`,
`average_current`, `frequency_hz`, `region`.

Raw column names are normalized once, centrally, in `schema.py`:

| Raw | Normalized |
|---|---|
| `meter` | `meter_id` |
| `x_Timestamp` / `Date` | `timestamp` |
| `t_kWh` | `consumption` |
| `z_Avg Voltage (Volt)` | `average_voltage` |
| `z_Avg Current (Amp)` | `average_current` |
| `y_Freq (Hz)` | `frequency_hz` |

Values are unchanged — only names. Nothing else in the codebase should
hardcode a raw CEEW column name.

## Validation (Priority 1 — the actual fix)

**Before A.5**: `validate_no_duplicates()` and `validate_consumption_range()`
were computed and printed but never enforced — only
`validate_preprocessing()`'s result stopped the pipeline. Two-thirds of
the validation gate was decorative.

**After A.5**: `run_all_validations()` runs 8 checks — required columns,
no missing essentials, timestamp validity, meter_id validity (must start
with a known prefix), region known (not `'Unknown'`), no duplicates,
consumption range, timestamp ordering — and **every one of them blocks the
pipeline** if it fails. `pipeline.py` raises `ValueError` and writes no
output if any check fails. Regression-tested in
`tests/test_pipeline_e2e.py::test_pipeline_stops_on_validation_failure`
(injects a duplicate row and confirms the pipeline raises and writes zero
Parquet files).

## Configuration (config.py)

One `Config` dataclass, overridable via environment variables
(`METERIQ_DATA_DIR`, `METERIQ_LOG_LEVEL`, `METERIQ_RANDOM_SEED`, etc.) —
no config-file framework, per the explicit "don't overengineer" instruction.
Everything that used to be a hardcoded constant across multiple files
(sampling interval, voltage bounds, dropout policy, feature windows,
input file list) now lives here.

## Logging (logging_config.py)

Every `print()` in the pipeline is now `logger.info/warning/error`, with
timestamps and levels, going to both stdout and `logs/pipeline.log`. One
line per meaningful event (file cleaned, validation result, batch
processed, cache hit/miss) — not per row.

## Caching (cache.py)

Cache key = SHA-256 of (sorted input filenames + each file's size/mtime +
pipeline/schema version string). Two cached artifacts:
`data/cache/processed_<hash>.parquet` (post-cleaning) and
`data/cache/features_<hash>.parquet` (post-feature-engineering). If any
input file changes or the pipeline/schema version is bumped, the hash
changes and the cache is correctly invalidated — no manual clearing
needed. `--force-recompute` bypasses it explicitly.

## The sorted-input contract (Priority 7)

`add_lag_features()`/`add_rolling_features()` had a hard, previously
unenforced precondition: input must be sorted by `(meter_id, timestamp)`.
Fixed by auto-sorting internally (`_ensure_sorted()`) with a logged
`WARNING` when it had to act — chosen over raising an exception because it
can never silently produce wrong values regardless of what a future
caller passes in. Tested in
`test_features.py::test_unsorted_input_is_handled_safely_not_silently_wrong`
(confirms shuffled input produces byte-identical results to sorted input).

## Tests (44 total)

```
tests/test_cleaning.py     13 tests - standardize/clean/region/dropout/voltage
tests/test_validation.py   14 tests - every check, individually and via run_all_validations
tests/test_features.py      9 tests - time/lag/rolling/change features, sorted-input contract
tests/test_leakage.py       6 tests - see below
tests/test_pipeline_e2e.py  2 tests - small-sample e2e, and validation-failure enforcement
```

All synthetic, small, fast (0.7s total) - no CSVs required to run them.

### Leakage tests — and a real gap I found while building them

The brief's method ("perturb a future observation, recompute, confirm the
past is unchanged") is implemented for rolling mean/std, deviation
features, and same-week lag. But while verifying my own tests weren't
vacuous (I deliberately broke the `shift(1)` guard and confirmed the
existing tests should fail), I found that future-perturbation tests
**do not catch a feature reading its own current-row value** — that's a
same-timestamp leak, not a future one, and needs its own test. Added
`test_rolling_features_do_not_include_the_current_row_itself`, confirmed
it fails on the broken code and passes on the fix. Both vectors are now
covered.

## Memory & the full-scale benchmark — what actually happened

The Phase A audit flagged that full-scale (~19.6M row) memory behavior had
never been measured. It has now, and getting there took three real,
measured failures — not hypothetical ones:

1. **First full run**: the pipeline correctly *refused* to proceed.
   `validate_timestamp_ordering` failed for 44 of 46 Bareilly meters.
   Root cause: the new memory-safe streaming writer wrote files in
   *config list order*, not *chronological order* — Bareilly's 2019 data
   lives in a separate file that was processed after 2020/2021, so it
   landed physically after them in the output.
2. **Fix attempt (resort after writing)**: fixed the ordering, but caused
   two consecutive **OOM kills**, confirmed via the kernel's own dmesg
   log (`anon-rss:3922600kB` at the moment of the kill), not guessed.
   Root cause: the streaming writer created one Parquet row group per
   *source file* (up to 6.6M rows each) — so a per-meter filtered read
   still had to decompress an entire multi-million-row row group,
   defeating the purpose of batching.
3. **Root-cause fix**: reordered `config.input_files` to be chronological
   per region (eliminates the need for the expensive resort in the normal
   case — it's now conditional, only runs if a cheap sortedness check
   actually fails), set `row_group_size=200_000` on the one-time resort
   path so filtered reads only touch a bounded number of row groups, and
   downcast rolling features from float64 to float32 (pandas upcasts
   rolling aggregations by default regardless of input dtype).

**Final, verified result** (measured via `resource.getrusage().ru_maxrss`,
not estimated):

| Metric | Value |
|---|---|
| Rows processed | 19,648,865 |
| Meters | 84 (46 Bareilly, 38 Mathura) |
| Runtime | 111.3 seconds |
| Peak RSS | **2,519.5 MB** (of 3.9GB available) |
| Validation | all 8 checks pass |

I also measured `batch_size=15` (an earlier, larger setting): it completes
successfully at 3,639.6 MB peak — only ~260MB of headroom, too close for
comfort. `batch_size=5` is the shipped default specifically because it
was measured, not assumed, to leave a safe margin.

## Run manifest (Priority 10)

Every successful run writes `data/output/pipeline_run.json`: timestamp,
pipeline/schema version, input files, per-file clean stats (rows in,
dropout rows removed, rows removed by clean_dataset, rows out),
validation results, feature row count, output path, elapsed time. Example
from the actual verified run is in this repo's history — regenerate with
any run.

## Known limitations

1. Sensor-dropout rows (all-zero across kWh/voltage/current/freq) are
   treated as missing and dropped by default — override via
   `run_dropout_policy(df, drop_dropout_rows=False)` if you want to
   inspect them first.
2. No ground-truth theft labels exist anywhere in the dataset (confirmed,
   not assumed) — UC1 must be unsupervised/statistical.
3. `weather_proxy.py` is a synthetic seasonal placeholder, not real
   weather — every column is suffixed `_proxy` for exactly this reason.
4. The calendar in `calendar_features.py` covers major national holidays
   plus Holi/Diwali for 2019-2021, verified via web search — it is
   explicitly *not* an exhaustive list of every regional/religious UP
   holiday.
5. `config.input_files` ordering is load-bearing for the low-memory path
   (see the benchmark section above) — adding a new source file for an
   existing region needs to go in the right chronological position, not
   just appended to the list.
6. EDA plotting (`eda.py`) is unchanged from the original upload and
   still uses matplotlib `palette=` without `hue=`, which raises a
   (non-blocking) `FutureWarning` on current seaborn — cosmetic, not
   fixed, since it still works and wasn't flagged as broken.

## Not done yet (later phases, by design — at the time of the Phase A notes)

UC1 anomaly/risk detection, UC2 forecasting, real weather integration,
FastAPI backend, React integration. All of these have since been implemented;
see the note at the top of this file and the root `README.md`.

---

# Phase B / B.1: UC1 Anomaly / Investigation-Risk Detection

This covers UC1 only - anomaly/risk screening for meters that deserve
human investigation. It is explicitly NOT a theft detector: there are no
ground-truth theft labels anywhere in the dataset (confirmed by
inspection in Phase A), so nothing here is trained or evaluated against
theft outcomes, and no accuracy/precision/recall/F1 is ever reported for
"theft detection" - that would require labels that don't exist. Output is
always one of `NORMAL` / `REVIEW` / `HIGH_RISK`, never a theft claim.

**This section reflects Phase B.1** - a validation pass that found and
fixed two real scoring bugs in the initial Phase B implementation. Both
are documented in full below, including the actual numbers before and
after, because the corrected calibration is the main thing worth
understanding about how this detector behaves.

## Structure

```
backend/
  ml/
    anomaly/
      baseline.py          <- transparent statistical signals (deviation_z,
                               pct_change, per-meter-normalized weekly deviation)
      isolation_forest.py  <- per-meter IsolationForest, chronological train/score split,
                               percentile-against-training-reference severity
      scoring.py            <- combines baseline + IF (each normalized to its own
                               0-1 strength first) into 0-100 severity -> risk level
      explainability.py    <- human-readable reasons from actual feature values
      summary.py            <- meter-level anomaly summary (neutral language)
      visualization.py     <- diagnostic plots
      pipeline.py            <- orchestrates everything, `python -m ml.anomaly.pipeline`
    evaluation/
      anomaly_evaluation.py <- evaluation without fabricated accuracy metrics
  tests/
    test_anomaly_baseline.py, test_isolation_forest.py,
    test_anomaly_explanations.py, test_anomaly_pipeline.py   <- 32 tests
```

## How to run

```bash
cd backend
pip install -r requirements.txt --break-system-packages   # verified in a clean venv - see below

# Phase A.5 features must exist first:
python -m ml.pipeline

# Small sample (fast, for development):
python -m ml.anomaly.pipeline --sample-meters BR02 MH01

# Full run (all 84 meters):
python -m ml.anomaly.pipeline

# Test suite:
python -m pytest -v
```

**Troubleshooting a Parquet-related test failure**: if `read_parquet`/
`to_parquet` calls fail, pyarrow isn't actually installed in your
environment despite being in `requirements.txt` - run
`python3 -c "import pyarrow"` to confirm, and re-run
`pip install -r requirements.txt` if it errors. This was independently
verified twice during Phase B.1 (once via `--break-system-packages` into
system site-packages, once via a from-scratch `python3 -m venv` with no
prior state) - both installs correctly pulled in pyarrow and all tests
passed, so a failure here means something environment-specific, not a
gap in `requirements.txt` itself.

## Bug #1 (Phase B.1): Isolation Forest severity calibration was wrong

**Before**: `isolation_forest_severity` was computed by min-max scaling
the raw decision score *within each meter's scoring window* - so every
meter's own minimum became ~0 and its own maximum became ~100,
*regardless of how anomalous that meter's most extreme point actually
was*. The code comment claimed this made severity "comparable across
meters" - it did the opposite: a meter whose worst scoring-window point
was genuinely mild still scored 100 for it.

**After**: severity is the percentile rank of each scored point's raw
anomaly score against **that meter's own training-set score
distribution** (not the scoring window). The training set is a fixed
reference representing what the model learned as "normal"; a scoring
window made entirely of mundane points now correctly stays low across the
board instead of being stretched to fill 0-100. Regression-tested
(`test_severity_does_not_force_every_window_to_span_0_to_100`,
`test_severity_reflects_genuine_novelty_relative_to_training`).

## Bug #2 (Phase B.1): combining baseline + Isolation Forest severity with one shared threshold was wrong

This one was subtler and only showed up when actually running the fixed
Isolation Forest against real data. `isolation_forest_severity` is a
percentile rank - **close to uniformly distributed by construction** when
the scoring period's raw-score distribution resembles the training
period's (verified directly: for meter BR02, train raw-score mean/median
were -0.177/-0.192 vs score period's -0.179/-0.191 - nearly identical).
A percentile rank of 20 therefore means "more anomalous than only the
bottom 20%" - on a near-uniform scale, ~80% of any similar dataset
exceeds that by definition. Applying the baseline's `review=20` threshold
directly to this completely different scale produced an **83% flag rate
from Isolation Forest alone**, measured on a real 17-meter/3.6M-row
sample - not a fluke, a direct consequence of the scale mismatch.

**Fix**: `isolation_forest_severity` now gets its own percentile-based
thresholds (`isolation_forest_review_percentile=90`,
`isolation_forest_high_percentile=97` - directly, definitionally
justified on a percentile scale, unlike baseline's thresholds which
needed empirical grounding) and is converted to a 0-1 "strength" using
them *before* combining with baseline via `max()` - the same
clip-to-strength pattern `baseline.py` already used internally for its
own three signals, just applied one level up. Regression-tested
(`test_isolation_forest_severity_needs_its_own_high_percentile_to_flag`,
`test_isolation_forest_severity_above_high_percentile_does_flag`).

## A vs B vs C comparison (Issue 4) - measured on the full 19,648,865-row dataset

| Detector | Review rate | High-risk rate | Total flagged |
|---|---|---|---|
| A. Baseline only | 2.49% | 5.17% | 7.67% |
| B. Isolation Forest only (raw percentile, baseline's thresholds applied - demonstrates the bug) | 30.03% | 55.61% | **85.64%** |
| C. Combined (buggy, pre-fix) | 9.69% | 16.84% | 26.52% *(measured on 17-meter sample before the fix existed to re-run at full scale)* |
| C. Combined (fixed) | 3.05% | 7.64% | **10.70%** |

These are the exact numbers in `anomaly_run.json`'s `component_comparison`
field for the final run, not estimates.

**Honest conclusion (per the brief's explicit instruction not to assume
IF automatically helps)**: Isolation Forest, once correctly calibrated,
contributes a modest escalation on top of the baseline (7.67% -> 10.70%
combined, full-dataset numbers) rather than a dramatic one. It is not useless - the
"genuine novelty" regression test confirms it correctly reacts to a real
multivariate outlier - but its marginal contribution over the transparent
statistical baseline is real but not large. Both are kept, since IF is
now stable and cheap to compute, but the baseline alone would already
provide most of the value.

## Threshold sensitivity (Issue 3) - real 17-meter sample, fixed combination method

| review_t | high_t | review_rate | high_rate | total_flagged |
|---|---|---|---|---|
| 10 | 50 | 0.0876 | 0.0696 | 0.1572 |
| 15 | 55 | 0.0451 | 0.0679 | 0.1130 |
| 20 | 55 | 0.0258 | 0.0679 | **0.0937** |
| 20 | 70 | 0.0679 | 0.0463 | 0.1142 |
| 30 | 70 | 0.0155 | 0.0463 | 0.0618 |
| 40 | 80 | 0.0094 | 0.0329 | 0.0423 |

(Full grid computed across review in {10,15,20,30,40,50} x high in
{40,50,55,60,70,80}, high > review only.) The total flagged rate stays
in a stable, gracefully-varying 4-16% band across this whole grid - a
meaningfully different (and much healthier) picture than the pre-fix
combination method, which swung from 6.7% to 83% depending on which
component dominated. **Kept the existing 20/55 pair** - the full-dataset
run (all 84 meters) confirms this same pair at 10.70% combined, close to
this sample's 9.37%, so the sample-based grid generalized well.
It sits comfortably mid-range and isn't a boundary artifact of the grid.
There is no ground-truth label to prove this is "the correct" pair; it's
a documented, configurable, non-arbitrary choice, not a definitive one.

## Per-meter stability (Issue 6) - full 84-meter run

Mean anomaly rate 10.45%, median ~9-10%, std 4.14%, min 1.25% (BR42),
max 22.1% (MH34). BR42's low rate has a specific, documented explanation,
not a mystery: it has an unusually short history, so the lag/rolling
warm-up period (which needs up to 1 week = 3,360 rows before `lag_1w` is
defined) consumes a much larger *fraction* of its data than for
longer-history meters - measured directly, one meter had 97% of its
training rows dropped to NaN before Isolation Forest could use them,
leaving a bare margin above `min_observations_per_meter=2000`. This is a
data-availability artifact, not evidence the detector is broken for that
meter. Higher-rate meters (MH34, and BR07 at 18.7% in the smaller sample)
are described using neutral terms only - "elevated investigation-signal
frequency" - never "worst offender" or similar, per Issue 6's explicit
instruction; whether that elevated rate reflects real behavioral
volatility or something else is a question for the human reviewer, not a
conclusion this system draws.

## Leakage verification (Issue 5)

Unchanged from Phase B: chronological per-meter train/score split
(`chronological_split()`), regression-tested for zero timestamp overlap
between train and score portions, and that no scored row's model was ever
trained on data at or after its own timestamp. The Phase B.1 scoring
fixes touched only post-hoc arithmetic on already-computed severity
values (percentile-of-training-reference calculation, and the
strength-normalization-before-max combination) - neither introduces any
new dependency on future information. All leakage tests from Phase B
still pass unchanged.

## Data quality vs. behavioral anomaly (Issue 7)

Unchanged, still correct: `data_quality_flag` (from `is_voltage_outlier`)
is independent of the behavioral risk level, and the explanation text
says so explicitly when true. Regression-tested
(`test_data_quality_flag_separated_from_behavioral_risk`).

## Explanations (Issue 8)

Unchanged, still correct: every reason is generated from that row's own
feature values, never a generic template, and regression-tested to never
contain "theft", "stealing", "confirmed", or "guilty"
(`test_no_reason_ever_claims_theft`).

## Tests (32 total for UC1, 76 total with Phase A.5)

```
test_anomaly_baseline.py       10 tests (+2 for the combination fix)
test_isolation_forest.py       10 tests (+2 for the calibration fix)
test_anomaly_explanations.py    8 tests
test_anomaly_pipeline.py        4 tests
```

## Full-scale benchmark (final, post-fix, with full manifest)

84/84 meters, 19,648,865 observations, **341.5 seconds**, **3,268.7 MB
peak RSS** (measured via `resource.getrusage()`). This run also computes
the full `component_comparison` (Issue 4) at full scale, which costs
extra memory over the minimal version (2,701.0 MB measured in an earlier
run without that comparison) - still 630MB under the 3.9GB ceiling. All
84 meters had enough training history for Isolation Forest.

**Final risk-level distribution**: NORMAL 89.30% (17,547,012), REVIEW
3.05% (600,003), HIGH_RISK 7.64% (1,501,850). Combined flagged rate
10.69% - down from the pre-fix 20.87%, and far more stable than the
intermediate (mid-fix) 83% Isolation-Forest-only finding.

## Output artifacts

```
data/output/anomaly/
  anomaly_observations.parquet    (~1.1 GB - every scored row, all 19.6M+)
  meter_anomaly_summary.parquet   (84 rows - one per meter)
  anomaly_run.json                (manifest)
  plots/
    severity_distribution.png
    anomaly_counts_per_meter.png
    timeseries_<example_meter>.png
    severity_<example_meter>.png
```

## Known limitations

1. Isolation Forest's marginal contribution over the baseline alone is
   real but modest (7.67% -> 10.70% combined flag rate, full dataset) -
   stated plainly, not oversold.
2. No supervised evaluation exists or can exist without real labels.
3. Threshold choice (20/55) is defensible and stable across a sensitivity
   grid, but not provably "correct" - it remains configurable
   (`config.risk_review_severity`/`risk_high_severity`) rather than fixed.
4. Meters with short overall history (e.g. BR42) get a thinner effective
   training set for Isolation Forest due to lag/rolling warm-up loss -
   documented, not hidden, and still above the configured reliability
   floor in every case observed.
5. `weather_proxy.py` remains untouched and unused as an anomaly feature.

## Recommendation: is UC1 ready for dashboard integration?

**Yes, with the Phase B.1 fixes in place** - the pre-fix version (83%
Isolation-Forest-only flag rate, 20.87% combined) was not. The corrected
version produces a stable ~10.7% combined flag rate, a well-behaved
threshold-sensitivity profile, passing leakage tests, and explanations
that never overclaim. The main caveat for integration: `risk_level`
should be presented to reviewers explicitly as a screening signal (the
existing explanation text already does this), and the per-meter
`meter_anomaly_summary.parquet` should probably be the primary dashboard
view rather than the raw 19.6M-row observation table, given its size.

## What remains for UC2

Not started in this task, per instructions. The same per-meter
chronological-split pattern, the same narrow-column/streaming memory
discipline (now validated against real OOM failures, not just theory),
and the already-computed same-hour-last-week features
(`lag_1w`/`deviation_from_same_hour_last_week`) carry over directly.
