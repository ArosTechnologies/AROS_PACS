FROM python:3.14-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies: curl (health check), libpq (if using postgres), build tools for cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies from requirements.txt (reproducible)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose the Clinic API port
EXPOSE 8001

# Liveness + Readiness healthcheck — Docker/ECS will mark container unhealthy if this fails
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl --fail http://localhost:8001/ready/ || exit 1

# For production: replace with gunicorn or daphne
CMD ["python", "manage.py", "runserver", "0.0.0.0:8001"]
