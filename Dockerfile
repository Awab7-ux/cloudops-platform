FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATABASE_URL=sqlite:////data/cloudops.db

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /data \
    && chown 10001:10001 /data
# WHY: the mounted /data directory must be writable by the non-root user so
# SQLite can create and update its database file when a named volume is mounted.

COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

COPY app ./app

USER 10001:10001
EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\""]
