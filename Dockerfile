FROM node:22-alpine

# Byggverktøy for native moduler (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY server.js .
COPY public/ public/

ENV PORT=3000
EXPOSE 3000

VOLUME ["/data"]

CMD ["node", "server.js"]
