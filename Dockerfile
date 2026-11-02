FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/server.js /app/AGENTS.md ./
COPY --from=build /app/skills ./skills
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node","server.js"]
