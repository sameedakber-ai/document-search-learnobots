# Use Python 3.12 slim image
FROM python:3.12-slim

# Prevents Python from writing .pyc files and enables output buffering
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app/backend

# Install system dependencies required for building some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# Copy only requirements to leverage Docker cache
COPY requirements.txt .

# Upgrade pip and install Python dependencies
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy the rest of the backend code (including .env and entrypoint.sh)
COPY . .

# Ensure the entrypoint script is executable
RUN chmod +x /app/backend/entrypoint.sh

# Expose the port on which Daphne will run
EXPOSE 8000

# Use the entrypoint script to start the container
ENTRYPOINT ["sh", "/app/backend/entrypoint.sh"]