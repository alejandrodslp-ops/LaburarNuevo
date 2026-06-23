import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(async () => {
  const key = Deno.env.get("RESEND_API_KEY") ?? "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Konexu <noreply@konexu.app>",
      to: ["alejandrodslp@gmail.com"],
      subject: "Texto para WhatsApp — Banco Rendimento CNR",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1A1020;padding:24px 32px"><span style="font-size:26px;font-weight:900;color:#E8785A">Konexu</span></div><div style="padding:32px"><h2 style="color:#1A1020;margin-bottom:16px">Texto para enviar por WhatsApp a Banco Rendimento</h2><div style="background:#F2FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:20px;font-size:15px;line-height:1.8;color:#1A1020"><p>Ol&aacute;! Sou cidad&atilde;o uruguaio, resido no Uruguai e tenho CPF brasileiro v&aacute;lido. Tenho interesse em abrir uma conta CNR para receber pagamentos via PIX de clientes brasileiros.</p><br><p>Gostaria de confirmar:</p><p>1. Posso abrir uma conta CNR sendo estrangeiro (n&atilde;o brasileiro) com CPF v&aacute;lido?</p><p>2. Voc&ecirc;s aceitam n&uacute;mero de telefone uruguaio (+598) para o cadastro?</p><p>3. Quais documentos s&atilde;o necess&aacute;rios para o meu perfil?</p><br><p>Agrade&ccedil;o desde j&aacute;.</p></div><p style="margin-top:20px;font-size:13px;color:#999">Copi&aacute; ese texto y peg&aacute;lo en el WhatsApp de Banco Rendimento.</p></div></div>`
    }),
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});
