# Use the official Node.js image as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package.json to install dependencies
COPY package.json ./

# Install dependencies with pnpm
RUN pnpm install

# Copy the rest of the application code
COPY . .

# Expose the port your application will run on (replace 3000 with your app's port)
EXPOSE 3000

# Set the command to run your application
CMD ["pnpm", "start"]
