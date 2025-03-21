# Stage 1: Build the React app using Node
FROM node:22.13.0-alpine as builder

# Set working directory for the frontend
WORKDIR /app/frontend

# Copy package files to install dependencies (leveraging Docker cache)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend source code
COPY . ./

# Build the app (ensure your package.json has a "build" script)
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:alpine

# Remove default Nginx website content
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from the builder stage to Nginx html folder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy your custom Nginx configuration into the final image
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for Nginx
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]