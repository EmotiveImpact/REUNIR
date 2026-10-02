FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_DATA_MODE=live
ENV VITE_DATA_MODE=$VITE_DATA_MODE
RUN npm run build
FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
WORKDIR /app
COPY --from=build /app /app
USER node
EXPOSE 8787
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]
