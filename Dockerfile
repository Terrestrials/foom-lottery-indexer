FROM node:22.2.0-bullseye-slim

RUN mkdir -p /home/node/foom-lottery-indexer/node_modules \
    && chown -R node:node /home/node/foom-lottery-indexer

RUN rm /bin/sh && ln -s /bin/bash /bin/sh

RUN apt-get update && apt-get install -y python3 python3-pip \
    && ln -s /usr/bin/python3 /usr/bin/python
RUN npm install -g pnpm@9.15.5
RUN npm install -g @nestjs/cli

USER node

COPY --chown=node:node package.json pnpm-lock.yaml ./

WORKDIR /home/node/foom-lottery-indexer

COPY --chown=node . .

ARG NODE_ENV=production
ENV NODE_ENV=production
ARG NODE_REMOTE=true
ENV NODE_REMOTE=true

RUN pnpm install --frozen-lockfile --production && pnpm store prune && pnpm build

EXPOSE 80
CMD pnpm start:production
