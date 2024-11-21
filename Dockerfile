# Stage 1: C++ Build Environment
FROM ubuntu:22.04 as cpp-builder
WORKDIR /app

# Install C++ build dependencies
RUN apt-get update && apt-get install -y \
    git \
    make \
    g++ \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy C++ project files
COPY . .

# Build C++ project
RUN mkdir -p build && \
    cd build && \
    cmake .. && \
    make

# Stage 2: Node.js Build Environment
FROM node:18-alpine as node-builder
WORKDIR /app

# Copy package files from ncd-calculator
COPY ncd-calculator/package*.json ./ncd-calculator/

# Install dependencies
WORKDIR /app/ncd-calculator
RUN npm install

# Copy source code from ncd-calculator
COPY ncd-calculator/ .

# Build the app
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Stage 3: Final Production Environment
FROM nginx:alpine

# Copy built assets from node builder
COPY --from=node-builder /app/ncd-calculator/dist /usr/share/nginx/html

# Create directory for C++ application
WORKDIR /app

# Copy compiled C++ binaries from cpp-builder
COPY --from=cpp-builder /app/build /app/build

# Install runtime dependencies for C++ application
RUN apk add --no-cache \
    libstdc++ \
    libgcc

# Copy a startup script
RUN echo '#!/bin/sh\n\
# Start nginx\n\
nginx -g "daemon off;"' > /start.sh

RUN chmod +x /start.sh

# Expose port 80 for nginx
EXPOSE 80

# Use the startup script as the entry point
CMD ["/start.sh"]
