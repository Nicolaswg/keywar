# Build from the repo root: docker build -f apps/server/Dockerfile .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @keywar/server...
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN pnpm --filter @keywar/server build && pnpm --filter @keywar/server deploy --prod --legacy /out

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=2567
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./
COPY --from=build /repo/apps/server/dist ./dist
EXPOSE 2567
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:2567/health || exit 1
CMD ["node", "dist/index.js"]
