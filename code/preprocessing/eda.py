import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

def plot_consumption_distribution(df, title="Consumption Distribution"):
    plt.figure(figsize=(10, 6))
    sns.histplot(df['consumption'], bins=50, kde=True, color='skyblue')
    plt.title(title)
    plt.xlabel("Consumption (kWh)")
    plt.ylabel("Frequency")
    plt.grid(axis='y', alpha=0.3)
    plt.show()

def plot_temporal_patterns(df):
    """
    Plots average consumption by hour of day and day of week.
    """
    # Ensure time features exist
    if 'hour' not in df.columns or 'day_of_week' not in df.columns:
        from .feature_engineering import add_time_features
        df = add_time_features(df)
    
    fig, axes = plt.subplots(2, 1, figsize=(15, 12))
    
    # Hourly Pattern
    hourly_avg = df.groupby('hour')['consumption'].mean()
    sns.barplot(x=hourly_avg.index, y=hourly_avg.values, ax=axes[0], palette='viridis')
    axes[0].set_title("Average Consumption by Hour of Day")
    axes[0].set_xlabel("Hour")
    axes[0].set_ylabel("Avg Consumption (kWh)")
    
    # Daily Pattern
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    daily_avg = df.groupby('day_of_week')['consumption'].mean()
    sns.barplot(x=days, y=daily_avg.values, ax=axes[1], palette='magma')
    axes[1].set_title("Average Consumption by Day of Week")
    axes[1].set_xlabel("Day")
    axes[1].set_ylabel("Avg Consumption (kWh)")
    
    plt.tight_layout()
    plt.show()

def plot_meter_comparison(df, num_meters=3):
    """
    Plots consumption timelines for a few random meters.
    """
    meters = df['meter_id'].unique()
    selected_meters = np.random.choice(meters, min(num_meters, len(meters)), replace=False)
    
    plt.figure(figsize=(15, 8))
    for i, meter in enumerate(selected_meters):
        meter_df = df[df['meter_id'] == meter].sort_values('timestamp')
        plt.plot(pd.to_datetime(meter_df['timestamp']), meter_df['consumption'], label=f"Meter {meter}", alpha=0.7)
    
    plt.title(f"Consumption Comparison for {num_meters} Random Meters")
    plt.xlabel("Time")
    plt.ylabel("Consumption (kWh)")
    plt.legend()
    plt.show()

def plot_feature_correlations(df):
    """
    Plots a heatmap of correlations between consumption and engineered features.
    """
    # Select only numeric columns for correlation
    numeric_df = df.select_dtypes(include=[np.number])
    corr = numeric_df.corr()
    
    plt.figure(figsize=(12, 10))
    # Filter for correlations with 'consumption' to keep it readable
    cons_corr = corr[['consumption']].sort_values(by='consumption', ascending=False)
    sns.heatmap(cons_corr, annot=True, cmap='coolwarm', fmt=".2f")
    plt.title("Correlation of Features with Consumption")
    plt.show()

def plot_gap_distribution(df):
    """
    Visualizes the distribution of time gaps between readings.
    """
    gaps = []
    for meter, group in df.groupby('meter_id'):
        group = group.sort_values('timestamp')
        diffs = group['timestamp'].diff().dt.total_seconds()
        gaps.extend(diffs.dropna().tolist())
    
    plt.figure(figsize=(10, 6))
    sns.histplot(gaps, bins=50, color='salmon')
    plt.title("Distribution of Sampling Gaps (Seconds)")
    plt.xlabel("Gap (Seconds)")
    plt.ylabel("Frequency")
    plt.show()
