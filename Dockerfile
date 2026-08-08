# Build stage
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ git

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

RUN if [ "$TARGETARCH" = "arm64" ]; then \
      CFLAGS="-DOPUS_ARM_MAY_HAVE_NEON_INTR" pnpm install --frozen-lockfile; \
    else \
      pnpm install --frozen-lockfile; \
    fi

COPY . .
RUN pnpm build

# Production stage
FROM node:22-alpine

RUN apk add --no-cache ffmpeg python3

RUN apk upgrade --no-cache

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV TZ=Europe/Madrid

CMD ["node", "dist/index.js"]
