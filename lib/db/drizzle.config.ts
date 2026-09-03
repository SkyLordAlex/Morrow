import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Relative to this config file. Kept forward-slashed rather than
  // path.join(__dirname, …): drizzle-kit globs the value, and a Windows
  // backslash path makes micromatch drop every match.
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
