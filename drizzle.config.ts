import { config } from 'dotenv';
config();
config({ path: '.env.local', override: false });
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // You can enable verbose for debugging generation/migration issues
  // verbose: true,
});
