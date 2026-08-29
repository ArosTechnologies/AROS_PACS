# ──────────────────────────────────────────────
#  RadiographXpress — Production Dockerfile
# ──────────────────────────────────────────────
FROM python:3.13-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── System dependencies ──────────────────────
# WeasyPrint needs pango, cairo, gdk-pixbuf, and fonts.
# psycopg needs libpq. pikepdf needs libqpdf.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    libglib2.0-0 \
    shared-mime-info \
    fonts-dejavu-core \
    libpq5 \
    libqpdf-dev \
    && rm -rf /var/lib/apt/lists/*

# ── App setup ─────────────────────────────────
WORKDIR /app

# Install Python deps first (cacheable layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Collect static files (uses dummy SECRET_KEY so manage.py runs without a real .env)
RUN SECRET_KEY=build-dummy \
    DEBUG=False \
    ALLOWED_HOSTS=* \
    USE_S3=False \
    python manage.py collectstatic --noinput

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# ── Runtime ───────────────────────────────────
EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
