# ---- Build stage ----
FROM node:22 AS build

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

COPY . .

# PWA icons are generated at build time (binary PNGs not committed)
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pil \
    && rm -rf /var/lib/apt/lists/* \
    && python3 scripts/generate_pwa_icons.py

RUN pnpm build

# Bundle the one-shot DB migration runner
RUN pnpm exec esbuild server/migrate.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/migrate.js

# ---- Runtime stage ----
FROM node:22-slim AS runtime

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN pnpm install --prod --no-frozen-lockfile

COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
ENV PORT=3000
CMD ["./entrypoint.sh"]
