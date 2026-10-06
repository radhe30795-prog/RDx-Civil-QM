// One-shot DB migration runner (bundled to dist/migrate.js in Docker build,
// executed by entrypoint.sh at container boot).
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL not set — skipping");
    return;
  }
  const pool = mysql.createPool({
    uri: url,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    connectionLimit: 2,
  });
  const db = drizzle(pool);
  // drizzle/ is copied next to dist/ in the runtime image
  const migrationsFolder = path.resolve(__dirname, "..", "drizzle");
  console.log("[migrate] running from", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("[migrate] done");
  await pool.end();
}

main().catch((e) => {
  console.error("[migrate] failed:", e);
  process.exit(1);
});
