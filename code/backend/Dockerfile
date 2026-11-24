
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY . .

# Render health check and application port
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]
