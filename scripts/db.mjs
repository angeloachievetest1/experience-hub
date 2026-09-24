// Shared database connection for the scripts in this folder.
// Reads DATABASE_URL (and optionally SUPABASE_DB_PASSWORD) from .env.local.
import pg from 'pg';

export function connectionString() {
  let url = process.env.DATABASE_URL;
  if (!url || url.includes('YOUR-PROJECT')) {
    fail('DATABASE_URL is missing from .env.local. See docs/setup-phase-1.md, step 3.');
  }
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (url.includes('[YOUR-PASSWORD]')) {
    if (!password) fail('Put your database password in SUPABASE_DB_PASSWORD in .env.local.');
    url = url.replace('[YOUR-PASSWORD]', encodeURIComponent(password));
  }
  // SSL is configured below; drop sslmode so the driver doesn't override it.
  const parsed = new URL(url);
  parsed.searchParams.delete('sslmode');
  return parsed.toString();
}

export async function connect() {
  const client = new pg.Client({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
  } catch (err) {
    fail(`Could not connect to the database: ${err.message}\n` +
      'Check DATABASE_URL and SUPABASE_DB_PASSWORD in .env.local.');
  }
  return client;
}

export function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}
