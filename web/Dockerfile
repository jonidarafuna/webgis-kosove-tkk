FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY . .
EXPOSE 5500
ENV HOST=0.0.0.0
ENV PORT=5500
ENV GEOSERVER_URL=http://geoserver:8080
CMD ["node", "serve.js"]
