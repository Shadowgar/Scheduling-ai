# Backend Dockerfile for Flask API

FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy backend code
COPY . .

# Set environment variables
ENV FLASK_APP=app.py
ENV FLASK_ENV=development

# Expose Flask port
EXPOSE 5000

# Run Flask with reload enabled
CMD ["flask", "run", "--host=0.0.0.0"]
