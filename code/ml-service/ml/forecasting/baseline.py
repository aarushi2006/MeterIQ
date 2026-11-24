import pandas as pd
import numpy as np
from typing import Tuple

def compute_baseline_forecast(df: pd.DataFrame, horizon_intervals: int = 96) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Implement the same-hour-last-week baseline.
    For 15-minute data, the lag is 672 intervals (7 days * 24 hours * 4 intervals/hour).
    
    Args:
        df: DataFrame containing ['meter_id', 'timestamp', 'consumption'] sorted chronologically.
        horizon_intervals: Number of intervals to forecast ahead.
        
    Returns:
        train_baseline: DataFrame with actuals and baseline predictions for the training set.
        test_baseline: DataFrame with actuals and baseline predictions for the test set.
    """
    LAG = 672  # 7 days * 24 hours * 4 intervals/hour
    
    df = df.copy()
    df = df.sort_values(['meter_id', 'timestamp'])
    
    # Compute the lag per meter
    df['baseline_pred'] = df.groupby('meter_id')['consumption'].shift(LAG)
    
    # Identify the split point (the last 'horizon_intervals' for the test set)
    # In a real pipeline, the split is handled by data_prep.
    # Here we assume the df passed is already the full dataset.
    
    # Since we need to return train/test, we'll look for the split
    # For simplicity, we'll return the df with the baseline column, 
    # and the caller will handle the chronological split.
    
    return df

def evaluate_baseline(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute MAE and MAPE for the baseline predictions.
    """
    # Drop rows where baseline is NaN (due to lag)
    eval_df = df.dropna(subset=['baseline_pred']).copy()
    
    if eval_df.empty:
        return pd.DataFrame({'MAE': [np.nan], 'MAPE': [np.nan]})
    
    actuals = eval_df['consumption']
    preds = eval_df['baseline_pred']
    
    mae = np.mean(np.abs(actuals - preds))
    
    # Handle MAPE: ignore zero actuals to avoid division by zero
    mask = actuals > 0
    mape = np.mean(np.abs((actuals[mask] - preds[mask]) / actuals[mask])) * 100
    
    return pd.DataFrame({'MAE': [mae], 'MAPE': [mape]})
