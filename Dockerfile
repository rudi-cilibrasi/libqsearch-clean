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

# Make runtests executable
RUN chmod +x runtests

RUN sed -i 's/mkdir build/mkdir -p build/' runtests || true

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
WORKDIR /app

# Copy built assets from node builder
COPY --from=node-builder /app/ncd-calculator/dist /usr/share/nginx/html

# Copy C++ files for testing
COPY --from=cpp-builder /app .

# Install runtime dependencies
RUN apk add --no-cache \
    libstdc++ \
    libgcc

# Use nginx directly instead of a startup script
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
