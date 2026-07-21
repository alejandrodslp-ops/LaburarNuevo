import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const URL = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function ok(d: unknown) {
  return new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", ...CORS } });
}
function err(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const db = createClient(URL, KEY, { auth: { persistSession: false } });

  try {
    const {
      accion, email, nombre, push_token, pais, busqueda, ciudad, origen,
      // Bloque opcional "reservar cuenta" (2026-07-21) — si viene alguno de
      // estos, además del insert normal a waitlist, se crea una cuenta real
      // (auth.users + profiles). Nadie pierde el camino de solo-alertas si
      // no manda ninguno de estos campos.
      apellido1, apellido2, telefono, fecha_nac, sexo, anios_experiencia, profesiones, especialidades, idiomas,
      disponibilidad, tipos_empleo, sueldo_pretension_min, sueldo_pretension_max,
      descripcion_libre,
    } = await req.json();

    // ── Estado global de la waitlist ──────────────────────────────────────────
    if (accion === "estado") {
      const { data: cfg } = await db.from("waitlist_config").select("activo, batch_size, intervalo_minutos").eq("id", 1).single();
      const { count: total }      = await db.from("waitlist").select("*", { count: "exact", head: true });
      const { count: pendientes } = await db.from("waitlist").select("*", { count: "exact", head: true }).eq("habilitado", true).eq("registrado", false);
      return ok({ activo: cfg?.activo ?? false, total_espera: total ?? 0, pendientes: pendientes ?? 0 });
    }

    if (!email || !email.includes("@")) return err("Email inválido");
    const emailLower = email.toLowerCase().trim();

    // ── Consultar posición de un email ────────────────────────────────────────
    if (accion === "consultar") {
      const { data: cfg }    = await db.from("waitlist_config").select("activo").eq("id", 1).single();
      const { data: entrada } = await db.from("waitlist").select("posicion,habilitado,registrado").eq("email", emailLower).maybeSingle();
      return ok({
        activo:     cfg?.activo    ?? false,
        en_lista:   !!entrada,
        habilitado: entrada?.habilitado ?? false,
        registrado: entrada?.registrado ?? false,
        posicion:   entrada?.posicion   ?? null,
      });
    }

    // ── Unirse a la waitlist ──────────────────────────────────────────────────
    if (accion === "unirse") {
      // El formulario web manda origen:"web" — para él, país/ciudad/búsqueda son obligatorios.
      // La app (WaitlistScreen) no manda origen y queda exenta: no pide esos campos.
      if (origen === "web" && (!nombre?.trim() || !pais || !busqueda?.trim() || !ciudad?.trim())) {
        return err("Nombre, país, ciudad y búsqueda son obligatorios");
      }
      const { data: existente } = await db.from("waitlist").select("posicion,habilitado").eq("email", emailLower).maybeSingle();
      if (existente) return ok({ ya_estaba: true, posicion: existente.posicion, habilitado: existente.habilitado });

      const { data: nuevo, error: insErr } = await db.from("waitlist")
        .insert({ email: emailLower, nombre: nombre?.trim() ?? null, push_token: push_token ?? null, pais: pais ?? null, busqueda: busqueda?.trim()?.slice(0, 120) || null, ciudad: ciudad?.trim()?.slice(0, 80) || null })
        .select("posicion")
        .single();

      if (insErr) return err(insErr.message);

      // Disparar autorizador en background (no esperamos respuesta)
      fetch(`${URL}/functions/v1/waitlist-autorizador`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});

      // ── Bloque opcional: crear cuenta real + perfil ──────────────────────
      // Solo si trajo algo del bloque "reservar cuenta". Un fallo acá NUNCA
      // debe romper la respuesta de la waitlist (esa parte ya se guardó bien).
      const camposExtra = { apellido1, apellido2, telefono, fecha_nac, sexo, anios_experiencia, profesiones, especialidades, idiomas, disponibilidad, tipos_empleo, sueldo_pretension_min, sueldo_pretension_max, descripcion_libre };
      const quiereCuenta = Object.values(camposExtra).some((v) => v !== null && v !== undefined && v !== "");
      let cuenta_creada = false;
      if (quiereCuenta) {
        try {
          const passwordDescartable = crypto.randomUUID() + crypto.randomUUID();
          const { data: nuevoUser, error: createErr } = await db.auth.admin.createUser({
            email: emailLower, password: passwordDescartable, email_confirm: true,
          });
          if (createErr) {
            // Email ya tiene cuenta real (se registró en la app antes) — no es un error, se omite.
            if (!String(createErr.message ?? "").toLowerCase().includes("already")) {
              console.log(`waitlist: no se pudo crear cuenta para ${emailLower}: ${createErr.message}`);
            }
          } else if (nuevoUser?.user?.id) {
            const codigoReferido = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { error: profErr } = await db.from("profiles").insert({
              id: nuevoUser.user.id,
              nombre: nombre?.trim() ?? null,
              apellido1: apellido1?.trim() ?? null,
              apellido2: apellido2?.trim() ?? null,
              pais: pais ?? null,
              ciudad: ciudad?.trim() ?? null,
              empleo_buscado: busqueda?.trim() ?? null,
              telefono: telefono ?? null,
              fecha_nac: fecha_nac ?? null,
              sexo: sexo ?? null,
              anios_experiencia: anios_experiencia ?? null,
              profesiones: profesiones ?? null,
              especialidades: especialidades ?? null,
              idiomas: idiomas ?? null,
              disponibilidad: disponibilidad ?? null,
              tipos_empleo: tipos_empleo ?? null,
              sueldo_pretension_min: sueldo_pretension_min ?? null,
              sueldo_pretension_max: sueldo_pretension_max ?? null,
              descripcion_libre: descripcion_libre ?? null,
              rol: "worker",
              codigo_referido: codigoReferido,
              periodo_gratis_hasta: null, // se activa recién en el lanzamiento, no ahora
            });
            if (profErr) {
              console.log(`waitlist: cuenta creada pero falló el perfil de ${emailLower}: ${profErr.message}`);
            } else {
              // El trigger trigger_perfil_gratis pone perfil_activo=true en CUALQUIER
              // insert a profiles, sin condición — y BuscarScreen.js filtra empleadores
              // por perfil_activo=true. Sin este paso, alguien que solo llenó el
              // formulario web (nunca puso contraseña, no sabe que tiene cuenta)
              // quedaría visible y contactable por empleadores ya mismo. Se corrige
              // acá; activar-preregistrados lo vuelve a poner en true recién en el
              // lanzamiento real.
              await db.from("profiles").update({ perfil_activo: false }).eq("id", nuevoUser.user.id);
              cuenta_creada = true;
            }
          }
        } catch (e: any) {
          console.log(`waitlist: excepción creando cuenta para ${emailLower}: ${e.message}`);
        }
      }

      return ok({ posicion: nuevo.posicion, habilitado: false, ya_estaba: false, cuenta_creada });
    }

    // ── Marcar como registrado (llamar después del signUp exitoso) ────────────
    if (accion === "registrado") {
      await db.from("waitlist").update({ registrado: true }).eq("email", emailLower);
      return ok({ ok: true });
    }

    return err("acción desconocida");
  } catch (e: any) {
    return err(e.message);
  }
});
