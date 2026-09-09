# MeterIQ data exploration

Create the folders (they are intentionally ignored by Git so raw utility data is
not committed), then place supplied source files there without modification:

- `data/raw/mathura/`
- `data/raw/bareilly/`

```bash
mkdir -p data/raw/mathura data/raw/bareilly data/processed
```

Run the EDA command for each actual file:

```bash
python -m meteriq.eda data/raw/mathura/your_file.csv --name Mathura --output data/processed/mathura_eda.json
python -m meteriq.eda data/raw/bareilly/your_file.xlsx --name Bareilly --output data/processed/bareilly_eda.json
```

The report records observed row/column counts, data types, missing and duplicate rows, numeric ranges, negative and zero values, IQR-based values to inspect, likely timestamp frequency, and name-based column candidates. Candidate fields are suggestions only; verify them with the dataset documentation before using preprocessing or ML.

The EDA command supports `.csv`, `.tsv`, `.xlsx`, `.xls`, and `.parquet`. It only reads source data and writes an optional separate JSON report.
