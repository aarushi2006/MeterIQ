import pandas as pd
import numpy as np
from typing import Tuple
from ml.config import Config

def prepare_forecasting_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Prepare data for load forecasting:
    - Ensure chronological sorting per meter.
    - Reindex to ensure 15-minute regularity.
    - Handle missing values.
    - Prevent data leakage by ensuring no future-looking operations.
    """
    # 1. Ensure basic types and sorting
    df = df.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values(['meter_id', 'timestamp'])
    
    # 2. Regularize timestamps to 15-minute intervals per meter
    prepared_dfs = []
    for meter_id, group in df.groupby('meter_id'):
        group = group.set_index('timestamp')
        
        # Create a full 15-min range from min to max timestamp for this meter
        full_range = pd.date_range(
            start=group.index.min(), 
            end=group.index.max(), 
            freq='15T'
        )
        
        # Reindex to fill gaps
        group = group.reindex(full_range)
        group['meter_id'] = meter_id
        
        # Handle missing consumption: linear interpolation for small gaps, 
        # then forward fill for larger gaps
        group['consumption'] = group['consumption'].interpolate(method='linear', limit=4)
        group['consumption'] = group['consumption'].ffill().bfill()
        
        prepared_dfs.append(group.reset_index().rename(columns={'index': 'timestamp'}))
        
    return pd.concat(prepared_dfs, ignore_index=True)

def split_chronologically(df: pd.DataFrame, test_size_days: int = 30) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Split data into train and test sets using a chronological holdout.
    """
    max_date = df['timestamp'].max()
    split_date = max_date - pd.Timedelta(days=test_size_days)
    
    train = df[df['timestamp'] < split_date].copy()
    test = df[df['timestamp'] >= split_date].copy()
    
    return train, test
