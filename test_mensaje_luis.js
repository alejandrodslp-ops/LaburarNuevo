// ══════════════════════════════════════════════════════════
// Script de prueba: simula un empleador que inicia contacto
// con Luis Alejandro (trabajador) desde la app Laburar.
//
// Cómo correr:  node test_mensaje_luis.js
// ══════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://waevdcqdkovqaxkonlvj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BsNyiPJYPZDx8VdknHosFg_knBO1c2R';

const LUIS_WORKER_ID  = '8435b6b9-a747-48a5-ae68-7d84d472ca5d'; // Luis Alejandro (trabajador)
const TEST_EMAIL      = 'empleador_test_' + Date.now() + '@laburar.test';
const TEST_PASSWORD   = 'Test1234!';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('\n═══ TEST: mensaje empleador → Luis Alejandro ═══\n');

  // ── 1. Crear cuenta empleador de prueba ──────────────────
  console.log('1. Creando cuenta empleador de prueba...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signUpError) {
    console.error('✗ Error al crear cuenta:', signUpError.message);
    process.exit(1);
  }

  const empleadorId = signUpData.user?.id;
  if (!empleadorId) {
    console.error('✗ No se obtuvo el ID del usuario creado');
    process.exit(1);
  }
  console.log('✓ Cuenta creada. ID empleador:', empleadorId);

  // ── 2. Crear perfil del empleador de prueba ───────────────
  console.log('\n2. Creando perfil de empleador...');
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id:               empleadorId,
      nombre:           'Juan',
      apellido1:        'García',
      rol:              'employer',
      pais:             'Uruguay',
      ciudad:           'Montevideo',
      barrio:           'Centro',
      telefono:         '099000000',
      bio:              'Empresa de construcción buscando personal',
      perfil_visible:   true,
      perfil_activo:    true,
      es_empleador:     true,
      es_trabajador:    false,
      modo_activo:      'employer',
    });

  if (profileError) {
    console.error('✗ Error al crear perfil:', profileError.message);
    console.log('  (Igual intento enviar el mensaje...)\n');
  } else {
    console.log('✓ Perfil creado correctamente');
  }

  // ── 3. Enviar mensaje al trabajador Luis Alejandro ────────
  console.log('\n3. Enviando mensaje a Luis Alejandro...');
  const { data: msgData, error: msgError } = await supabase
    .from('mensajes')
    .insert({
      sender_id:   empleadorId,
      receiver_id: LUIS_WORKER_ID,
      texto:       'Hola Luis Alejandro, vi tu perfil en Laburar y me interesa tu experiencia. Tenemos una oportunidad de trabajo disponible en Montevideo. ¿Estás disponible para hablar?',
      leido:       false,
    })
    .select('id, sender_id, receiver_id, texto, created_at')
    .single();

  if (msgError) {
    console.error('✗ Error al enviar mensaje:', msgError.message);

    if (msgError.message.includes('permission denied')) {
      console.log('\n⚠️  FALTA CORRER EL SQL DE FIX:');
      console.log('   1. Abrí supabase.com → tu proyecto → SQL Editor');
      console.log('   2. Pegá y ejecutá el contenido de: supabase/fix_mensajes.sql');
      console.log('   3. Volvé a correr este script\n');
    }
    process.exit(1);
  }

  // ── 4. Verificar que el mensaje quedó en la base ──────────
  console.log('✓ Mensaje enviado con éxito!');
  console.log('\n──── Mensaje guardado ────');
  console.log('  ID:         ', msgData.id);
  console.log('  De:         ', empleadorId, '(Juan García - empleador test)');
  console.log('  Para:       ', LUIS_WORKER_ID, '(Luis Alejandro - trabajador)');
  console.log('  Texto:      ', msgData.texto);
  console.log('  Fecha:      ', new Date(msgData.created_at).toLocaleString('es-UY'));
  console.log('─────────────────────────');

  console.log('\n✅ LISTO. Ahora abrí la app con la cuenta de Luis Alejandro');
  console.log('   → Tocá "Mensajes" en la barra de navegación');
  console.log('   → Deberías ver la conversación con Juan García\n');
}

main().catch(err => {
  console.error('Error inesperado:', err.message);
  process.exit(1);
});
