# Build stage
FROM node:18-alpine as builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy source code and config files
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create log directory
RUN mkdir -p /var/log/complearn_api

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Use node with explicit ESM flag
CMD ["node", "--experimental-specifier-resolution=node", "./dist/bin/www.js"]