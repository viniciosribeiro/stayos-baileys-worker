FROM node:20-slim
# Baileys pulls a transitive dep via git+https, so git + CA certs are required.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.mjs ./
ENV PORT=8080
ENV DATA_DIR=/data
EXPOSE 8080
CMD ["node", "index.mjs"]
