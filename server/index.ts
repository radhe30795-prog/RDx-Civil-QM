import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { sessions, users } from "../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import type { Context } from "./trpc";
import type { SafeUser } from "../drizzle/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve the logged-in user from the x-auth-token header.
// Returns null when there is no token, it is expired, or the user is inactive.
async function resolveUser(req: express.Request): Promise<SafeUser | null> {
  const token = req.header("x-auth-token");
  if (!token) return null;
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())));
    const row = rows[0] as any;
    if (!row?.user || !row.user.isActive) return null;
    const { passwordHash, ...safe } = row.user;
    return safe as SafeUser;
  } catch {
    return null;
  }
}

async function start() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true, app: "rdx-civil-qm" }));

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: async ({ req }): Promise<Context> => ({
        user: await resolveUser(req),
      }),
    })
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
