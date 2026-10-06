import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

let db: any = null;

export async function getDb() {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — running without database");
    return null;
  }
  const pool = mysql.createPool({
    uri: url,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 5,
  });
  db = drizzle(pool);
  return db;
}
