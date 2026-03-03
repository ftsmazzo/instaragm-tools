# API FabriaIA (Fastify)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY --from=builder /app/dist ./dist
RUN npm install --omit=dev
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["node", "dist/index.js"]
