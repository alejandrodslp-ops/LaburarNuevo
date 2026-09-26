const { Router } = require('express');
const { db } = require('../lib/supabase');
const router = Router();

// Chequeo determinístico V1 — sin IA. Longitud mínima, sin URLs sueltas,
// sin términos de spam/discriminatorios. Se puede reforzar después sin
// cambiar el flujo (queda todo en esta única función).
// "bitcoin"/"cripto" sueltos se sacaron: pegan en puestos legítimos
// (cajero de casa de cambio, desarrollador blockchain, etc). Solo quedan
// frases que en conjunto son casi siempre estafa/pirámide.
const PALABRAS_PROHIBIDAS = [
  "dinero facil", "dinero gratis", "gratis dinero", "cripto invers", "inversion piramidal",
  "piramide", "esquema piramidal", "gana dinero rapido", "ganar dinero rapido",
  "solo hombres", "solo mujeres", "no discapacitados", "no mayores de",
  // portugues — Brasil es el mercado principal, sitio bilingue ES/PT
  "dinheiro facil", "dinheiro gratis", "ganhe dinheiro rapido", "ganhar dinheiro rapido",
  "esquema em piramide", "investimento piramidal",
  "so homens", "so mulheres", "nao maiores de",
];
const URL_REGEX = /https?:\/\/|www\./i;

function quitarAcentos(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function revisarContenido(oferta) {
  const textoOriginal = `${oferta.titulo} ${oferta.descripcion || ""} ${oferta.empleo || ""} ${oferta.requisitos || ""} ${oferta.beneficios || ""}`;
  const texto = quitarAcentos(textoOriginal.toLowerCase());

  if (oferta.titulo.trim().length < 5) {
    return { ok: false, motivo: "El título es demasiado corto para describir la búsqueda." };
  }
  if (URL_REGEX.test(textoOriginal)) {
    return { ok: false, motivo: "No se permiten links externos en la publicación." };
  }
  for (const p of PALABRAS_PROHIBIDAS) {
    if (texto.includes(quitarAcentos(p))) {
      return { ok: false, motivo: `El contenido no cumple con las normas de Konexu (frase detectada: "${p}").` };
    }
  }
  return { ok: true };
}

async function pushEmpresa(employerId, titulo, body, data) {
  const { data: profile } = await db
    .from("profiles")
    .select("push_token")
    .eq("id", employerId)
    .single();
  if (!profile?.push_token) return;

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ to: profile.push_token, title: titulo, body, sound: "default", data }),
  }).catch(() => {});
}

router.post('/', async (req, res) => {
  try {
    const { data: pendientes, error } = await db
      .from("ofertas")
      .select("id, employer_id, titulo, descripcion, empleo, requisitos, beneficios, created_at")
      .eq("estado", "pendiente")
      .lte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;
    if (!pendientes?.length) {
      return res.json({ ok: true, revisadas: 0 });
    }

    let aprobadas = 0, rechazadas = 0;

    for (const o of pendientes) {
      const resultado = revisarContenido(o);

      if (resultado.ok) {
        await db.from("ofertas").update({ estado: "aprobada", activa: true }).eq("id", o.id);
        aprobadas++;
        await pushEmpresa(
          o.employer_id,
          "Tu búsqueda ya está activa",
          `Tu búsqueda de ${o.empleo || o.titulo} ya está activa en Konexu.`,
          { pantalla: "MisOfertasEmpresa", oferta_id: o.id }
        );
        fetch(`http://localhost:${process.env.PORT || 3000}/match-ofertas`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oferta_id: o.id }),
        }).catch(() => {});
      } else {
        await db.from("ofertas").update({ estado: "rechazada", motivo_rechazo: resultado.motivo, activa: false }).eq("id", o.id);
        rechazadas++;
        await pushEmpresa(
          o.employer_id,
          "Tu búsqueda no pudo activarse",
          `Tu búsqueda de ${o.empleo || o.titulo} no pudo activarse: ${resultado.motivo} Podés editarla y volver a enviarla.`,
          { pantalla: "MisOfertasEmpresa", oferta_id: o.id }
        );
      }
    }

    res.json({ ok: true, revisadas: pendientes.length, aprobadas, rechazadas });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
