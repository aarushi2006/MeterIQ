"""
Reusable logging setup for the MeterIQ pipeline. Import `get_logger(__name__)`
from any module instead of using print().
"""

import logging
import os
import sys

_CONFIGURED = False


def setup_logging(log_level: str = "INFO", log_dir: str = None):
    """
    Configures the root 'meteriq' logger once. Safe to call multiple times
    (only configures on the first call). Logs to stdout always, and
    additionally to a file under log_dir if provided.

    Deliberately one line per meaningful pipeline event, not per row -
    logging inside a per-row loop would flood the output and defeats the
    purpose of structured logging.
    """
    global _CONFIGURED
    if _CONFIGURED:
        return

    logger = logging.getLogger("meteriq")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
        file_handler = logging.FileHandler(os.path.join(log_dir, "pipeline.log"))
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """
    Returns a logger under the 'meteriq' namespace. Call setup_logging()
    once at the entrypoint (pipeline.py's __main__) before this is used;
    if it hasn't been called yet, this falls back to a basic stdout-only
    configuration so imports never crash or silently produce no output.
    """
    if not _CONFIGURED:
        setup_logging()
    return logging.getLogger(f"meteriq.{name}")
