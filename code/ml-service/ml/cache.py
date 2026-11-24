"""
Simple content-hash based caching for the pipeline's two expensive stages
(cleaning and feature engineering). Not a general-purpose caching
framework - just enough to avoid re-parsing ~1GB of CSV and re-computing
lag/rolling features on every run when nothing has actually changed.

Cache key = hash of (sorted input file list + each file's size + mtime +
the relevant config/schema version string). If any input file changes
(different size/mtime) or the pipeline/schema version is bumped, the hash
changes and the cache is correctly treated as stale - no manual cache
clearing needed in the common case.
"""

import hashlib
import os

from .logging_config import get_logger

logger = get_logger("cache")


def _file_fingerprint(path: str) -> str:
    stat = os.stat(path)
    return f"{os.path.basename(path)}:{stat.st_size}:{int(stat.st_mtime)}"


def compute_cache_key(data_dir: str, filenames, version_tag: str) -> str:
    """
    version_tag should combine everything that affects the cached output's
    correctness but isn't captured by the input files themselves - e.g.
    config.pipeline_version + schema.SCHEMA_VERSION.value.
    """
    parts = [version_tag]
    for fname in sorted(filenames):
        path = os.path.join(data_dir, fname)
        if os.path.exists(path):
            parts.append(_file_fingerprint(path))
        else:
            parts.append(f"{fname}:MISSING")

    key_str = "|".join(parts)
    return hashlib.sha256(key_str.encode("utf-8")).hexdigest()[:16]


def cache_path(cache_dir: str, stage: str, cache_key: str) -> str:
    os.makedirs(cache_dir, exist_ok=True)
    return os.path.join(cache_dir, f"{stage}_{cache_key}.parquet")


def load_if_cached(path: str):
    """Returns the cached DataFrame if the file exists, else None."""
    import pandas as pd

    if os.path.exists(path):
        logger.info(f"Cache hit: loading {path}")
        return pd.read_parquet(path)
    logger.info(f"Cache miss: {path} not found, will recompute")
    return None


def save_to_cache(df, path: str):
    df.to_parquet(path, index=False)
    logger.info(f"Cached result to {path}")
