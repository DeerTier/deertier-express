# DeerTier Express.js

This repository contains a full rewrite of [the original ASP.NET MVC website](https://github.com/tomvoros/deertier) for [deertier.com](https://deertier.com) now in **Express.js**. This is currently a straightforward 1:1 rewrite with no real improvements.

## Tech

The website is written in **Node.js 22** and **Express.js 5** using **Handlebars** with minimal additional dependencies.

## Database

To set up your own instance, enter the connection info (including `DATABASE_URL`) in **app/.env** and run, from the app folder:

- `npm run migrate` to apply all pending migrations
- `npm run db -- new <name>` to create a new migration
- `npm run db -- rollback` to roll back the latest migration
- `npm run db -- status` to list applied and pending migrations

Never edit a migration that has already been applied anywhere. Add a new one instead.

## Local development

1. `npm install`
2. Copy **.env.example** to **.env** and point it at the Docker database: `DB_HOST="localhost"`, `DB_PORT="3306"`, and `deertier` as database, user and password (also in `DATABASE_URL`).
3. `npm run db:start` starts MySQL in Docker and applies pending migrations. Run it again after pulling new migrations.
4. `npm run dev` starts the site on http://localhost:3000 and restarts it whenever a file in the app folder changes.

`npm run db:stop` stops the database. Its data is kept until you run `docker compose down -v` in the root folder.

## Docker

`docker compose up -d --build` starts the site on http://localhost:3000 together with a MySQL 8.4 database. Pending migrations are applied automatically on every start, and **db/schema.sql** is refreshed.

The defaults are meant for local development. To change them (DB credentials, `JWT_SECRET`, `ADMIN_KEY`, `APP_PORT`, `DB_HOST_PORT`), copy **.env.example** to **.env** next to **docker-compose.yml** and edit it. To recreate the database from scratch, run `docker compose down -v`.
