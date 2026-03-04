# Build (context: api/)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install && npm run build

# Run
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY --from=builder /app/dist ./dist
RUN npm install --omit=dev
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
