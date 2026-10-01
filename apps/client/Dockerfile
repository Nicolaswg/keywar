# Build from the repo root: docker build -f apps/client/Dockerfile --build-arg VITE_REGIONS=... .
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
ARG VITE_REGIONS
ENV VITE_REGIONS=$VITE_REGIONS
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile --filter @keywar/client...
COPY packages/shared packages/shared
COPY apps/client apps/client
RUN pnpm --filter @keywar/client build

FROM nginx:1.29-alpine
COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/client/dist /usr/share/nginx/html
EXPOSE 80
