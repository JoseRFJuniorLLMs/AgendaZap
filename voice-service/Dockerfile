FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

RUN mkdir -p /app/data /tmp/agendazap-voice

ENV NODE_ENV=production
ENV VOICE_PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=4s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]