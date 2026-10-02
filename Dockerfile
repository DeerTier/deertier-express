FROM node:22-slim

ARG TARGETARCH
ARG DBMATE_VERSION=2.36.0

ENV NODE_ENV=production

# dbmate applies db/migrations on deploy, from the same image as the code that needs them
ADD --chmod=755 https://github.com/amacneil/dbmate/releases/download/v${DBMATE_VERSION}/dbmate-linux-${TARGETARCH} /usr/local/bin/dbmate
ENV DBMATE_MIGRATIONS_DIR=/srv/db/migrations
COPY db/migrations /srv/db/migrations

# The app resolves ./config, ../logs and ../WebContentBackup relative to its
# working directory, so it lives in /srv/app with writable siblings in /srv.
WORKDIR /srv/app

# Install dependencies first so this layer is cached between code changes
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY app/ ./

RUN mkdir -p /srv/logs /srv/WebContentBackup \
  && chown node:node /srv/logs /srv/WebContentBackup

USER node

EXPOSE 3000

CMD ["node", "bin/www"]
