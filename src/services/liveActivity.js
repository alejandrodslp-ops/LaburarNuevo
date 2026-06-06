// ── Nexu Live Activity — iOS 16.1+ ─────────────────────────────────────────
// Controla el Live Activity de PIX en la Dynamic Island / Lock Screen
// Solo funciona en build nativo (EAS), no en Expo Go
//
// USO:
//   import { iniciarLiveActivityPIX, atualizarLiveActivityPIX, encerrarLiveActivityPIX } from './liveActivity'
//
//   // Cuando el usuario toca "Pagar PIX":
//   const activityId = await iniciarLiveActivityPIX(userId, 'Luis', 'R$ 15,00')
//
//   // Cuando el pago se confirma:
//   await atualizarLiveActivityPIX(activityId, 'confirmado', '✅ Perfil ativado! Já aparece para os empregadores.')
//
//   // Limpiar después de 5 segundos:
//   setTimeout(() => encerrarLiveActivityPIX(activityId), 5000)
// ────────────────────────────────────────────────────────────────────────────

import { Platform, NativeModules } from 'react-native';

const isLiveActivityAvailable = () => {
  return Platform.OS === 'ios' && !!NativeModules.NexuLiveActivity;
};

export async function iniciarLiveActivityPIX(userId, nome, monto) {
  if (!isLiveActivityAvailable()) return null;
  try {
    const activityId = await NativeModules.NexuLiveActivity.startActivity({
      userId,
      nome,
      estado:    'esperando',
      monto,
      mensagem:  'Aguardando pagamento PIX...',
    });
    return activityId;
  } catch (e) {
    console.warn('LiveActivity não disponível:', e.message);
    return null;
  }
}

export async function atualizarLiveActivityPIX(activityId, estado, mensagem) {
  if (!isLiveActivityAvailable() || !activityId) return;
  try {
    await NativeModules.NexuLiveActivity.updateActivity({
      activityId,
      estado,
      mensagem,
    });
  } catch (e) {
    console.warn('LiveActivity update error:', e.message);
  }
}

export async function encerrarLiveActivityPIX(activityId) {
  if (!isLiveActivityAvailable() || !activityId) return;
  try {
    await NativeModules.NexuLiveActivity.endActivity({ activityId });
  } catch (e) {
    console.warn('LiveActivity end error:', e.message);
  }
}
