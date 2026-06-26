const ALLOWED_HOSTS = [
  // Computrabajo — todos los países LatAm
  "computrabajo.com",
  "bo.computrabajo.com",
  "ec.computrabajo.com",
  "py.computrabajo.com",
  "ve.computrabajo.com",
  "cr.computrabajo.com",
  "sv.computrabajo.com",
  "ni.computrabajo.com",
  "pa.computrabajo.com",
  "do.computrabajo.com",
  "ar.computrabajo.com",
  "cl.computrabajo.com",
  "co.computrabajo.com",
  "pe.computrabajo.com",
  "mx.computrabajo.com",
  // México
  "dof.gob.mx",
  "www.dof.gob.mx",
  // Colombia
  "cnsc.gov.co",
  "www.cnsc.gov.co",
  // España
  "www.boe.es",
  "boe.es",
  // Uruguay
  "concursos.scs.gub.uy",
  "www.uruguayconcursa.gub.uy",
  // Chile
  "www.serviciocivil.cl",
  "serviciocivil.cl",
  // Argentina
  "www.boletinoficial.gob.ar",
  "boletinoficial.gob.ar",
  "www.trabajo.gob.ar",
  // Francia
  "emploi-public.gouv.fr",
  "place-emploi-public.gouv.fr",
  // Portugal
  "www.bep.gov.pt",
  "bep.gov.pt",
  // UK
  "civilservicejobs.service.gov.uk",
  "www.civilservicejobs.service.gov.uk",
  // Canada
  "jobs.gc.ca",
  "emploisfp-psjobs.cfp-psc.gc.ca",
  "emplois.gc.ca",
  // Australia
  "www.apsjobs.gov.au",
  "apsjobs.gov.au",
  // Brasil
  "www.pciconcursos.com.br",
  "pciconcursos.com.br",
];

const PROXY_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "identity",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Cache-Control": "no-cache",
};

export default {
  async fetch(request) {
    const reqUrl = new URL(request.url);

    if (reqUrl.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const target = reqUrl.searchParams.get("url");
    if (!target) {
      return new Response("Missing ?url= parameter", { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    const hostname = targetUrl.hostname;
    const allowed = ALLOWED_HOSTS.some((h) => hostname === h || hostname.endsWith("." + h));
    if (!allowed) {
      return new Response(`Host not allowed: ${hostname}`, { status: 403 });
    }

    const extraHeaders = {};
    if (hostname.includes("dof.gob.mx")) {
      extraHeaders["Accept-Language"] = "es-MX,es;q=0.9,en;q=0.8";
      extraHeaders["Referer"] = "https://www.google.com.mx/";
      extraHeaders["Sec-Fetch-Site"] = "cross-site";
    } else if (hostname.includes("cnsc.gov.co")) {
      extraHeaders["Accept-Language"] = "es-CO,es;q=0.9,en;q=0.8";
      extraHeaders["Referer"] = "https://www.google.com.co/";
      extraHeaders["Sec-Fetch-Site"] = "cross-site";
    }

    try {
      const res = await fetch(targetUrl.toString(), {
        method: "GET",
        headers: { ...PROXY_HEADERS, ...extraHeaders },
        redirect: "follow",
      });

      const body = await res.arrayBuffer();

      const responseHeaders = new Headers();
      responseHeaders.set("Content-Type", res.headers.get("Content-Type") || "text/html");
      responseHeaders.set("X-Proxy-Status", String(res.status));
      responseHeaders.set("Access-Control-Allow-Origin", "*");

      return new Response(body, {
        status: res.status,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
