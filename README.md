# Linda-Kura

Copy `.env.example` to `.env.local`, then run `npm install` and `npm run dev`. This starts Next.js on `http://localhost:3000` and the Fastify/Socket.IO placeholder API on port 3001. The browser uses Socket.IO first and automatically polls the summary endpoint every 15 seconds when that connection is unavailable.

`public/geojson` contains the supplied boundaries unchanged. `db/schema.sql` is a PostGIS-ready schema; load it with `psql -f db/schema.sql` after configuring PostgreSQL.
