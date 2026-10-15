FROM oven/bun:1.3.1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:24.15.0-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
# setup.ts is idempotent: it resolves the inboxes, connector and PAL and writes state.json before the server reads it.
CMD ["sh", "-c", "node --enable-source-maps dist/setup.mjs && exec node --enable-source-maps dist/server.mjs"]
