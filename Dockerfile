# Build stage
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ git

RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage
FROM node:22-alpine

RUN apk add --no-cache ffmpeg python3

# RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

RUN apk upgrade --no-cache

WORKDIR /app

# Run @discordjs/opus native build install
# RUN cd node_modules/.pnpm/@discordjs+opus@*/node_modules/@discordjs/opus && npm run install || true

# Run youtube-dl-exec postinstall to download yt-dlp binary
# RUN cd node_modules/.pnpm/youtube-dl-exec@*/node_modules/youtube-dl-exec && node scripts/postinstall.js || true

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV TZ=Europe/Madrid

CMD ["node", "dist/index.js"]
