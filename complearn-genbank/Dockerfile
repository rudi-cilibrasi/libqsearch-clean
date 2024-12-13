# Build stage
FROM node:18-alpine as builder
WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /var/log/complearn_api

ENV PORT=3001

EXPOSE 3001
CMD ["node", "./dist/bin/www.js"]