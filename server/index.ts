import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, app: "rdx-civil-qm" }));

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext: () => ({}) })
  );

  // Serve built PWA
  const pub = path.join(__dirname, "public");
  app.use(express.static(pub));
  app.get("*", (_req, res) => res.sendFile(path.join(pub, "index.html")));

  const port = parseInt(process.env.PORT || "3000");
  createServer(app).listen(port, () => console.log(`[qm] listening on :${port}`));
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
