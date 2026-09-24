// Applies any SQL files in supabase/migrations that haven't been applied yet.
// Usage: npm run db:migrate
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { connect } from './db.mjs';

const dir = path.join(process.cwd(), 'supabase', 'migrations');
const client = await connect();

await client.query(`
  create schema if not exists private;
  create table if not exists private.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  );
`);

const { rows } = await client.query('select name from private.schema_migrations');
const applied = new Set(rows.map((r) => r.name));
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
const pending = files.filter((f) => !applied.has(f));

if (pending.length === 0) {
  console.log('Database is up to date. Nothing to apply.');
}

for (const file of pending) {
  const sql = await readFile(path.join(dir, file), 'utf8');
  process.stdout.write(`Applying ${file} ... `);
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into private.schema_migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log('done');
  } catch (err) {
    await client.query('rollback');
    console.log('FAILED');
    console.error(`\n✖ ${err.message}\n  Nothing from ${file} was saved.\n`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
