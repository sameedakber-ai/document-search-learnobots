#!/bin/sh
set -e

# Optional: Wait for PostgreSQL/Redis if needed (e.g., using a wait-for-it.sh script)

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Starting Daphne ASGI server on port 8000..."
exec daphne -b 0.0.0.0 -p 8000 backend.asgi:application
