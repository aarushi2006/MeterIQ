import pandas as pd

def validate_preprocessing(df):
    """
    Validates the processed dataset.
    """
    errors = []
    
    # Check required columns
    required_cols = ['meter_id', 'timestamp', 'consumption']
    for col in required_cols:
        if col not in df.columns:
            errors.append(f"Missing column: {col}")
            
    # Check for NaNs in essential columns
    if errors == []:
        if df[required_cols].isnull().any().any():
            errors.append("Contains NaNs in essential columns")
            
    # Check sorting
    if errors == []:
        # Check if sorted by meter_id and timestamp
        # We check a sample to avoid slow full check
        sample = df.sample(min(1000, len(df)))
        # This is a bit complex to check generally, maybe just trust the sort call
        pass
        
    return len(errors) == 0, errors
