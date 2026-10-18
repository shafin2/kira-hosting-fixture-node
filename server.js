// Test app for Kira Hosting checks: version banner, env presence, disk fill, database.
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';

const VERSION = 'v1';
const port = Number(process.env.PORT || 3000);
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const json = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    try {
      if (url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(`<h1>Kira fixture ${VERSION}</h1>`);
      }
      if (url.pathname === '/env-check') {
        // Reports whether a variable is set, never its value.
        const name = url.searchParams.get('name') || 'KIRA_CANARY';
        return json(200, { name, present: Boolean(process.env[name]), length: (process.env[name] || '').length });
      }
      if (url.pathname === '/write') {
        const mb = Math.min(Number(url.searchParams.get('mb') || 1), 2000);
        mkdirSync('/tmp/fill', { recursive: true });
        const chunk = Buffer.alloc(1024 * 1024, 7);
        for (let i = 0; i < mb; i++) writeFileSync(`/tmp/fill/f${Date.now()}-${i}`, chunk);
        return json(200, { wroteMb: mb });
      }
      if (url.pathname === '/db') {
        if (!pool) return json(200, { database: false });
        await pool.query('create table if not exists hits (id serial primary key, at timestamptz default now())');
        if (req.method === 'POST') await pool.query('insert into hits default values');
        const { rows } = await pool.query('select count(*)::int as n from hits');
        return json(200, { database: true, hits: rows[0].n });
      }
      json(404, { error: 'not found' });
    } catch (error) {
      json(500, { error: String(error.message || error) });
    }
  })
  .listen(port, () => console.log(`fixture ${VERSION} listening on ${port}`));
