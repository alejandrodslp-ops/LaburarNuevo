// src/services/featureFlags.js
// ══════════════════════════════════════════════════════════════
// SISTEMA DE FEATURE FLAGS
// 
// Esto es lo que permite agregar funciones nuevas sin romper
// lo que ya funciona. Cada función nueva se puede:
//   - Activar/desactivar sin publicar una nueva versión
//   - Probar con un % de usuarios antes de lanzar a todos
//   - Revertir instantáneamente si algo sale mal
//   - Habilitar solo para ciertos países o roles
//
// Cómo agregar una función nueva:
//   1. Agregar la flag en DEFAULT_FLAGS con valor false
//   2. Desarrollar la función envuelta en: if (isEnabled('nueva_funcion'))
//   3. Cuando está lista: activarla desde el panel de admin
//      sin necesidad de publicar una nueva versión al App Store
// ══════════════════════════════════════════════════════════════

import { SecureAPI }    from './security';
import * as SecureStore from 'expo-secure-store';

// ── Flags por defecto (cuando no hay conexión al servidor) ──
const DEFAULT_FLAGS = {
  // ── Funciones actuales ──
  worker_profile:      true,   // Perfil del trabajador
  search_basic:        true,   // Búsqueda básica
  payment_card:        true,   // Pago con tarjeta
  payment_mercadopago: true,   // Pago con MercadoPago
  payment_abitab:      true,   // Pago con Abitab/RedPagos
  payment_cell:        false,  // Pago con saldo celular (habilitado por país)
  concursa:            true,   // Integración Uruguay Concursa
  messages:            true,   // Sistema de mensajes
  biometrics:          true,   // Acceso biométrico
  share_app:           true,   // Compartir app
  report_system:       true,   // Sistema de denuncias
  ratings:             true,   // Valoraciones
  multilanguage:       true,   // Múltiples idiomas
  recurring_activation:true,   // Activación recurrente

  // ── Funciones en desarrollo (desactivadas por defecto) ──
  company_portal:      false,  // Portal de empresas
  admin_panel:         false,  // Panel de administrador
  video_profile:       false,  // Video en el perfil
  document_upload:     false,  // Subir documentos de certificación
  premium_plan:        false,  // Plan Premium empresas
  ai_matching:         false,  // Matching con IA
  referral_program:    false,  // Programa de referidos
  push_notifications:  false,  // Notificaciones push
  geofencing:          false,  // Alertas por zona geográfica
  chat_support:        false,  // Chat con soporte en vivo
  analytics_dashboard: false,  // Dashboard de estadísticas para admin

  // ── Expansión regional ──
  market_argentina:    false,  // Expansión a Argentina
  market_brazil:       false,  // Expansión a Brasil
  market_chile:        false,  // Expansión a Chile
};

// ── Estado en memoria ──
let flags     = { ...DEFAULT_FLAGS };
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de caché

// ════════════════════════════════════════
// FUNCIONES PÚBLICAS
// ════════════════════════════════════════

// Verificar si una función está habilitada
export function isEnabled(flagName) {
  return flags[flagName] === true;
}

// Obtener todas las flags
export function getAllFlags() {
  return { ...flags };
}

// Cargar flags desde el servidor (con caché)
export async function loadFlags(userContext = {}) {
  try {
    const now = Date.now();

    // Si hay caché válida, no consultar al servidor
    if (lastFetch && (now - lastFetch) < CACHE_TTL) {
      return flags;
    }

    // Intentar cargar desde el servidor
    const serverFlags = await SecureAPI.post('/config/flags', {
      app_version: require('expo-constants').default.expoConfig.version,
      platform:    require('react-native').Platform.OS,
      country:     userContext.country || 'UY',
      role:        userContext.role || 'worker',
      user_id:     userContext.userId,
    });

    // Mezclar: server tiene prioridad, DEFAULT_FLAGS como fallback
    flags     = { ...DEFAULT_FLAGS, ...serverFlags };
    lastFetch = now;

    // Guardar en storage para uso offline
    await SecureStore.setItemAsync('lab_flags', JSON.stringify(flags)).catch(() => {});

    return flags;

  } catch (error) {
    // Si falla el servidor, intentar usar flags guardadas
    try {
      const cached = await SecureStore.getItemAsync('lab_flags');
      if (cached) {
        flags = { ...DEFAULT_FLAGS, ...JSON.parse(cached) };
      }
    } catch {}

    // Si todo falla, usar DEFAULT_FLAGS
    return flags;
  }
}

// Verificar si el pago por saldo celular está disponible en el país del usuario
export function isCellPaymentAvailable(countryCode) {
  const SUPPORTED_COUNTRIES = ['UY', 'AR', 'CL', 'MX', 'CO', 'PE'];
  return SUPPORTED_COUNTRIES.includes(countryCode?.toUpperCase());
}

// ════════════════════════════════════════
// HOOK PARA USAR EN COMPONENTES
// ════════════════════════════════════════

// Uso: const { isEnabled } = useFeatureFlags();
//      if (isEnabled('nueva_funcion')) { ... }
import { useState, useEffect } from 'react';

export function useFeatureFlags(userContext) {
  const [currentFlags, setCurrentFlags] = useState(flags);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetch() {
      setLoading(true);
      const updated = await loadFlags(userContext);
      if (mounted) {
        setCurrentFlags(updated);
        setLoading(false);
      }
    }
    fetch();
    return () => { mounted = false; };
  }, []);

  return {
    flags:     currentFlags,
    isEnabled: (name) => currentFlags[name] === true,
    loading,
  };
}
