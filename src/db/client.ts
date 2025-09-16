import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const url = process.env.DATABASE_URL;

if (!url) {
  if (process.env.NODE_ENV !== "production") {
    // Allow missing env in local dev so the app can still build
    console.warn("DATABASE_URL is not set. The database client will be unavailable.");
  } else {
    throw new Error("DATABASE_URL is required in production");
  }
}

export const sql = url ? neon(url) : undefined as unknown as ReturnType<typeof neon>;
export const db = url ? drizzle(sql) : (undefined as unknown as ReturnType<typeof drizzle>);
