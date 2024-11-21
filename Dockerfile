# Build stage
FROM node:18-alpine as builder
WORKDIR /app
# Change working directory to ncd-calculator
WORKDIR /app/ncd-calculator
# Copy package files from ncd-calculator
COPY ncd-calculator/package*.json ./
# Install dependencies
RUN npm install
# Copy source code from ncd-calculator
COPY ncd-calculator/ .
# Build the app
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build
# Production stage
FROM nginx:alpine
# Copy built assets from builder stage
COPY --from=builder /app/ncd-calculator/dist /usr/share/nginx/html
# Expose port 80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
