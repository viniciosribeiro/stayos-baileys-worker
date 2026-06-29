FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.mjs ./
ENV PORT=8080
ENV DATA_DIR=/data
EXPOSE 8080
CMD ["node", "index.mjs"]
