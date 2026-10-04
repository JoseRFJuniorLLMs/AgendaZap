FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit
COPY src ./src
COPY proto ./proto
COPY public ./public
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=8793 DATA_DIR=/app/data BASE_PATH=/AgendaZap
VOLUME ["/app/data"]
EXPOSE 8793
HEALTHCHECK --interval=30s --timeout=20s CMD node -e "fetch('http://127.0.0.1:8793/AgendaZap/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
