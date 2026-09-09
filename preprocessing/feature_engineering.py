import pandas as pd
import numpy as np

def add_time_features(df):
    """
    Adds calendar-based features.
    """
    df = df.copy()
    df['hour'] = df['timestamp'].dt.hour
    df['day'] = df['timestamp'].dt.day
    df['day_of_week'] = df['timestamp'].dt.dayofweek
    df['week'] = df['timestamp'].dt.isocalendar().week.astype(int)
    df['month'] = df['timestamp'].dt.month
    df['day_of_year'] = df['timestamp'].dt.dayofyear
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
    return df

def add_cyclical_features(df):
    """
    Adds sin/cos versions of cyclical time features.
    """
    df = df.copy()
    df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
    df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
    df['day_of_week_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
    df['day_of_week_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
    return df

def add_lag_features(df, lags=[1, 2, 3, 6, 12, 24, 48, 168], interval_min=3):
    """
    Adds lag features based on the sampling interval.
    """
    df = df.copy()
    for lag in lags:
        # Lag is index-based, not time-based. 
        # Since the data is sorted and (ideally) regular, 
        # lag 1 = 1 * interval_min minutes ago.
        df[f'lag_{lag}'] = df.groupby('meter_id')['consumption'].shift(lag)
    return df

def add_rolling_features(df, windows=[20, 100, 480]):
    """
    Adds rolling historical features.
    """
    df = df.copy()
    for w in windows:
        # We shift(1) to avoid data leakage (current value in rolling mean)
        rolled = df.groupby('meter_id')['consumption'].shift(1).rolling(window=w)
        df[f'rolling_mean_{w}'] = rolled.mean()
        df[f'rolling_std_{w}'] = rolled.std()
        df[f'rolling_min_{w}'] = rolled.min()
        df[f'rolling_max_{w}'] = rolled.max()
    return df

def add_anomaly_features(df):
    """
    Features specifically for anomaly detection.
    """
    df = df.copy()
    # Absolute change from previous
    df['diff_1'] = df.groupby('meter_id')['consumption'].diff()
    
    # Deviation from rolling mean (using the 100-window mean)
    if 'rolling_mean_100' in df.columns:
        df['dev_from_mean_100'] = df['consumption'] - df['rolling_mean_100']
        df['z_score_100'] = (df['consumption'] - df['rolling_mean_100']) / (df['rolling_std_100'] + 1e-6)
    
    # Night-time consumption (e.g., 00:00 to 06:00)
    df['is_night'] = df['hour'].between(0, 6).astype(int)
    
    return df

def add_forecasting_features(df):
    """
    Features specifically for forecasting.
    """
    # Most forecasting features are already covered by lags and rolling features
    # But we can add some more specifically oriented ones
    df = df.copy()
    # Example: Average consumption for this hour of the week for this meter
    # This would be a 'target encoding' style feature, must be done carefully to avoid leakage.
    # For now, we rely on the general lags.
    return df
