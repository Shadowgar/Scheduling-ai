# Frontend Dockerfile for React App

FROM node:18-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy frontend source code
COPY . .

# Expose React dev server port
EXPOSE 3000

# Start React app in development mode with hot reload
CMD ["npm", "start"]
