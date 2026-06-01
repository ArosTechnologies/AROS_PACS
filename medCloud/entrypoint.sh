#!/bin/bash
set -e

echo "Waiting for PostgreSQL..."
while ! python -c "
import os, psycopg
try:
    conn = psycopg.connect(os.environ['DATABASE_URL'])
    conn.close()
    exit(0)
except Exception:
    exit(1)
" 2>/dev/null; do
    sleep 1
done
echo "PostgreSQL is ready."

echo "Running migrations..."
python manage.py migrate --noinput

echo "Starting Daphne (ASGI)..."
exec daphne -b 0.0.0.0 -p 8000 medCloud.asgi:application
