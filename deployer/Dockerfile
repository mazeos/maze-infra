FROM node:20-alpine

# git + docker CLI + compose para ejecutar los deploys sobre el socket del host
RUN apk add --no-cache git bash docker-cli docker-cli-compose openssh-client

WORKDIR /app
COPY server.js .

EXPOSE 3000
CMD ["node", "server.js"]
