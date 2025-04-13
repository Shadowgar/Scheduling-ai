# Backend Dockerfile for Flask API

FROM python:3.10-slim

# Install system dependencies for faiss-cpu and other scientific packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        g++ \
        libopenblas-dev \
        wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy backend code
COPY . .

# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=development
ENV PYTHONPATH=/app

# Expose Flask port
EXPOSE 5000

# Run Flask with reload enabled
CMD ["flask", "run", "--host=0.0.0.0"]
