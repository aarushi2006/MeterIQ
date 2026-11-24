import pandas as pd
import numpy as np
from typing import Dict, Any

def calculate_metrics(actuals: pd.Series, preds: pd.Series) -> Dict[str, float]:
    """
    Calculate MAE and MAPE for forecasting.
    """
    # Ensure aligned indices
    common_idx = actuals.index.intersection(preds.index)
    y_true = actuals.loc[common_idx]
    y_pred = preds.loc[common_idx]
    
    if len(y_true) == 0:
        return {"MAE": np.nan, "MAPE": np.nan}
    
    # MAE
    mae = np.mean(np.abs(y_true - y_pred))
    
    # MAPE - handle zeros by ignoring them
    mask = y_true > 0
    if mask.any():
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
    else:
        mape = np.nan
        
    return {"MAE": mae, "MAPE": mape}

def evaluate_model_performance(df: pd.DataFrame, actual_col: str, pred_col: str, group_col: str = 'meter_id') -> pd.DataFrame:
    """
    Calculate performance metrics per group (e.g., per meter).
    """
    results = []
    for name, group in df.groupby(group_col):
        metrics = calculate_metrics(group[actual_col], group[pred_col])
        metrics[group_col] = name
        results.append(metrics)
        
    return pd.DataFrame(results).set_index(group_col)

def summarize_performance(metrics_df: pd.DataFrame) -> Dict[str, float]:
    """
    Aggregate per-meter metrics into overall project metrics.
    """
    return {
        "overall_mae": metrics_df['MAE'].mean(),
        "overall_mape": metrics_df['MAPE'].mean(),
        "median_mae": metrics_df['MAE'].median(),
        "median_mape": metrics_df['MAPE'].median()
    }
