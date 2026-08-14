import { Pool } from "pg";
import Redis from "ioredis";

/** Lazy clients keep local development working when Postgres/Redis are not running yet. */
export const database = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : undefined;
export const cache = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : undefined;
