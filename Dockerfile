# syntax=docker/dockerfile:1.7
###############################################################################
# popop-tool 生产镜像
#
# 技术栈：Vite 前端 SPA + Express 服务端（单进程），pnpm 构建
#   - 前端产物：dist/（index.html + assets）
#   - 服务端产物：dist/server/index.mjs
#   - 启动：node dist/server/index.mjs，监听 PORT（默认 3000），绑定 0.0.0.0
#   - 健康检查：GET /health
#
# 多阶段：base(Node+pnpm) → deps(生产依赖) → build(全量依赖+构建) → runner(运行)
###############################################################################

ARG NODE_VERSION=22

############################
# Stage 1: base
############################
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

############################
# Stage 2: deps（仅生产依赖）
############################
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

############################
# Stage 3: build（全量依赖 + 构建前端与服务端）
############################
FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:all

############################
# Stage 4: runner（最终镜像）
############################
FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# 仅拷运行所需：生产依赖 + 构建产物 + package.json
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY package.json ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server/index.mjs"]
