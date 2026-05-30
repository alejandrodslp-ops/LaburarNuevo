import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const replacer = (_: string, v: unknown) => typeof v === "bigint" ? Number(v) : v;
serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return new Response("no", { status: 401 });
  const { sql } = await req.json();
  const client = new Client(DB_URL);
  await client.connect();
  const results: unknown[] = [];
  for (const stmt of (sql as string[]).map((s:string)=>s.trim()).filter(Boolean)) {
    try { const r = await client.queryObject(stmt); results.push({ ok: true, label: stmt.slice(0,60), rows: r.rows }); }
    catch(e) { results.push({ ok: false, label: stmt.slice(0,60), error: (e as Error).message }); }
  }
  await client.end();
  return new Response(JSON.stringify({ results }, replacer), { headers: { "Content-Type": "application/json" } });
});
