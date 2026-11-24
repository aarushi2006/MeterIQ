import pandas as pd
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from typing import Tuple, List
from ml.config import Config

class LoadForecastingModel:
    def __init__(self, random_state=42):
        # Using HistGradientBoostingRegressor (similar to LightGBM/XGBoost)
        # This is significantly more powerful than standard RandomForest for time-series
        self.model = HistGradientBoostingRegressor(random_state=random_state)
        self.features = []

    def _create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Generate advanced features for load forecasting.
        """
        df = df.copy()
        df = df.sort_values(['meter_id', 'timestamp'])
        
        # 1. Calendar Features
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # 2. Multi-Scale Lagged Features
        # Short term (1h, 6h), Medium term (24h), Long term (1w)
        for lag in [4, 24, 96, 672]:
            df[f'lag_{lag}'] = df.groupby('meter_id')['consumption'].shift(lag)
            
        # 3. Adaptive Rolling Statistics
        # Window of 1h, 6h, 24h
        for window in [4, 24, 96]:
            df[f'rolling_mean_{window}'] = df.groupby('meter_id')['consumption'].transform(
                lambda x: x.shift(1).rolling(window=window).mean()
            )
            df[f'rolling_std_{window}'] = df.groupby('meter_id')['consumption'].transform(
                lambda x: x.shift(1).rolling(window=window).std()
            )
            
        # 4. Trend Feature (Difference between short and long rolling mean)
        df['trend_signal'] = df['rolling_mean_4'] - df['rolling_mean_96']
        
        # Drop NaNs
        df = df.dropna()
        
        # Identify feature columns
        feature_cols = [col for col in df.columns if col not in ['meter_id', 'timestamp', 'consumption']]
        self.features = feature_cols
        
        return df, feature_cols

    def train(self, df: pd.DataFrame):
        """
        Train the advanced Gradient Boosting model.
        """
        df_feat, features = self._create_features(df)
        X = df_feat[features]
        y = df_feat['consumption']
        self.model.fit(X, y)

    def predict(self, df: pd.DataFrame) -> pd.Series:
        """
        Generate forecasts.
        """
        df_feat, features = self._create_features(df)
        X = df_feat[features]
        preds = self.model.predict(X)
        return pd.Series(preds, index=df_feat.index)

    def get_feature_importance(self) -> pd.DataFrame:
        # HistGradientBoostingRegressor doesn't provide feature_importances_ directly
        # We return a dummy or use a different method (like permutation importance)
        # For this implementation, we'll return a note.
        return pd.DataFrame({'feature': self.features, 'importance': [0] * len(self.features)})
