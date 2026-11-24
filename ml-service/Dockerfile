FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code plus the small serving artifacts under data/output/.
# Raw CSV data and the Phase A feature caches are excluded via .dockerignore;
# they are only needed to regenerate artifacts, not to serve the API.
COPY . .

ENV PORT=8000 \
    METERIQ_OUTPUT_DIR=/app/data/output \
    METERIQ_CACHE_DIR=/app/data/cache

EXPOSE 8000

# Shell form so the platform-provided $PORT is honoured.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
