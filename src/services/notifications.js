import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'trial_notif_id';
const KEY_RECORDATORIOS = 'inactividad_notif_ids';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: nuevo } = await Notifications.requestPermissionsAsync();
    return nuevo === 'granted';
  }
  return true;
}

// Cancela la notificación de vencimiento anterior si existe.
async function cancelarAnterior() {
  const id = await AsyncStorage.getItem(KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(KEY);
  }
}

// Programa la notificación de vencimiento para la fecha indicada.
export async function scheduleTrialExpiry(fechaISO) {
  const tienePermiso = await requestNotificationPermission();
  if (!tienePermiso) return;

  await cancelarAnterior();

  const trigger = new Date(fechaISO);
  if (trigger <= new Date()) return; // ya venció, no programar

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Tu período de prueba expiró',
      body: 'Tu perfil ya no es visible para los empleadores. Activá tu membresía para seguir recibiendo oportunidades.',
      sound: true,
      data: { pantalla: 'Pago' },
    },
    trigger,
  });

  await AsyncStorage.setItem(KEY, id);
}

// Reprograma cuando se extiende el período por referidos.
export async function rescheduleTrialExpiry(fechaISO) {
  await scheduleTrialExpiry(fechaISO);
}

export async function cancelTrialExpiry() {
  await cancelarAnterior();
}

// Programa hasta 6 recordatorios cada 30 días a partir del vencimiento,
// para recordar al trabajador inactivo que puede usar el saldo SMS mensual.
export async function scheduleRecordatoriosInactividad(fechaExpiracionISO) {
  const tienePermiso = await requestNotificationPermission();
  if (!tienePermiso) return;

  await cancelarRecordatoriosInactividad();

  const expiry = new Date(fechaExpiracionISO);
  const ids = [];

  for (let i = 1; i <= 6; i++) {
    const trigger = new Date(expiry);
    trigger.setDate(trigger.getDate() + i * 30);
    trigger.setHours(10, 0, 0, 0);
    if (trigger <= new Date()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '¡Tus créditos SMS se pierden mañana!',
        body: 'Tu plan telefónico tiene saldo que ya pagaste y no vas a poder recuperar. Usalo ahora para reactivar tu perfil Konexu y seguir recibiendo oportunidades laborales.',
        sound: true,
        data: { pantalla: 'PagoActivacion', metodo: 'sms' },
      },
      trigger,
    });
    ids.push(id);
  }

  if (ids.length > 0) {
    await AsyncStorage.setItem(KEY_RECORDATORIOS, JSON.stringify(ids));
  }
}

export async function cancelarRecordatoriosInactividad() {
  try {
    const raw = await AsyncStorage.getItem(KEY_RECORDATORIOS);
    if (!raw) return;
    const ids = JSON.parse(raw);
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
    await AsyncStorage.removeItem(KEY_RECORDATORIOS);
  } catch {}
}

// metodo: 'sms' | 'mp' | 'tarjeta' — determina cómo se abre el recordatorio al tocarlo
export async function scheduleRenovacionReminder(fechaExpiracionISO, metodo) {
  const tienePermiso = await requestNotificationPermission();
  if (!tienePermiso) return;

  const expiry = new Date(fechaExpiracionISO);
  const ultimoDia = new Date(expiry.getFullYear(), expiry.getMonth() + 1, 0);
  ultimoDia.setHours(10, 0, 0, 0);

  if (ultimoDia <= new Date()) return;

  const esSMS = metodo === 'sms';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '¡Tu perfil está por vencer!',
      body: esSMS
        ? 'Renovalo con 1 toque — usá los SMS de tu plan que de todas formas no usarías.'
        : 'Tu activación de 60 días termina este mes. Renová para seguir apareciendo en las búsquedas.',
      sound: true,
      data: { pantalla: 'PagoActivacion', metodo: metodo || '' },
    },
    trigger: ultimoDia,
  });
}
