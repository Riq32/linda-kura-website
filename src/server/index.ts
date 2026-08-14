import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { mockResults } from "../lib/results";

const app = Fastify({ logger: true });
const io = new Server(app.server, { cors: { origin: true } });

async function start() {
  await app.register(cors, { origin: true });
  app.get("/health", async () => ({ ok: true }));
  app.get("/api/results/summary", async () => mockResults);
  io.on("connection", socket => { socket.emit("results:summary", mockResults); });
  await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: "0.0.0.0" });
}

void start();
