// Gestiona dominios de envío en Resend (crear subdominio de outreach + verificar).
// Body: { guard, action: "list"|"create"|"get"|"verify", name?, id? }
const KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const GUARD = "kx-capt-9f3a2b";

Deno.serve(async (req) => {
  const b = await req.json().catch(() => ({} as any));
  if (b.guard !== GUARD) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  if (!KEY) return new Response(JSON.stringify({ error: "sin RESEND_API_KEY" }), { status: 500 });

  const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
  const action = b.action || "list";
  let url = "https://api.resend.com/domains";
  let method = "GET";
  let body: string | undefined = undefined;

  if (action === "create") { method = "POST"; body = JSON.stringify({ name: b.name || "mail.konexu.app" }); }
  else if (action === "get") { url += "/" + b.id; }
  else if (action === "verify") { url += "/" + b.id + "/verify"; method = "POST"; }

  const r = await fetch(url, { method, headers: H, body });
  const j = await r.json().catch(() => ({}));
  return new Response(JSON.stringify({ http: r.status, data: j }), { headers: { "Content-Type": "application/json" } });
});
