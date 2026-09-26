FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @ganador/api...
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
