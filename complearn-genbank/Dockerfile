FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

RUN if [ -d "./dist" ]; then rm -rf ./dist; fi && \
    npx tsc # compile typescript to javascript

EXPOSE 3001
CMD ["node", "./dist/bin/www.js"]
