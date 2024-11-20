# Use the official Node.js image
FROM node:16-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of your application files
COPY . .

# Expose the port the app will run on
EXPOSE 3000

# Run the application
CMD ["npm", "start"]