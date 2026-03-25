# Build stage
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ git

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage
FROM node:22-alpine

RUN apk add --no-cache ffmpeg python3

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

# Run @discordjs/opus native build install
RUN cd node_modules/.pnpm/@discordjs+opus@*/node_modules/@discordjs/opus && npm run install || true

# Run youtube-dl-exec postinstall to download yt-dlp binary
RUN cd node_modules/.pnpm/youtube-dl-exec@*/node_modules/youtube-dl-exec && node scripts/postinstall.js || true

COPY --from=builder /app/dist ./dist

ENV FFMPEG_PATH=/usr/bin/ffmpeg

CMD ["node", "dist/index.js"]
