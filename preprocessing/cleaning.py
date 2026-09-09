import pandas as pd
import os
import glob

def standardize_dataset(df):
    """
    Standardizes the dataset columns and types.
    """
    mapping = {
        'meter': 'meter_id',
        'x_Timestamp': 'timestamp',
        't_kWh': 'consumption',
        'Date': 'timestamp'
    }
    df = df.rename(columns=mapping)
    
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    if 'consumption' in df.columns:
        df['consumption'] = pd.to_numeric(df['consumption'], errors='coerce')
        
    df = df.sort_values(by=['meter_id', 'timestamp'])
    df = df.drop_duplicates(subset=['meter_id', 'timestamp'], keep='first')
    
    return df

def clean_dataset(df):
    """
    Performs general cleaning operations.
    """
    # Remove rows with missing essential values
    df = df.dropna(subset=['meter_id', 'timestamp', 'consumption'])
    
    # Remove negative consumption
    df = df[df['consumption'] >= 0]
    
    return df
