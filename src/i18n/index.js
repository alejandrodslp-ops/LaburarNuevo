// src/i18n/index.js
// Sistema de internacionalización
// Español · Português · English

import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';

// ── Traducciones ──
const translations = {

  // ════════════════════════════
  // ESPAÑOL
  // ════════════════════════════
  es: {
    // General
    app_name: 'Laburar',
    loading: 'Cargando...',
    error_generic: 'Algo salió mal. Intentá de nuevo.',
    cancel: 'Cancelar',
    save: 'Guardar',
    continue: 'Continuar',
    back: 'Volver',
    yes: 'Sí',
    no: 'No',
    ok: 'Aceptar',
    close: 'Cerrar',
    search: 'Buscar',
    filter: 'Filtrar',
    see_all: 'Ver todo',
    required: 'Campo requerido',
    optional: 'Opcional',
    share: 'Compartir',
    report: 'Denunciar',
    contact: 'Contactar',
    edit: 'Editar',
    delete: 'Eliminar',
    confirm: 'Confirmar',

    // Autenticación
    auth: {
      login: 'Iniciar sesión',
      register: 'Registrarse',
      email: 'Email',
      password: 'Contraseña',
      confirm_password: 'Confirmar contraseña',
      forgot_password: '¿Olvidaste tu contraseña?',
      reset_password: 'Restablecer contraseña',
      login_google: 'Continuar con Google',
      login_apple: 'Continuar con Apple',
      login_biometric: 'Entrar con huella',
      login_biometric_face: 'Entrar con Face ID',
      no_account: '¿No tenés cuenta? Registrate',
      have_account: '¿Ya tenés cuenta? Iniciá sesión',
      terms_agree: 'Al continuar aceptás nuestros',
      terms_link: 'Términos y Condiciones',
      privacy_link: 'Política de Privacidad',
      terms_and: 'y la',
      email_placeholder: 'tu@email.com',
      password_placeholder: 'Mínimo 8 caracteres',
      password_mismatch: 'Las contraseñas no coinciden',
      email_invalid: 'Email no válido',
      password_short: 'La contraseña debe tener al menos 8 caracteres',
      login_error: 'Email o contraseña incorrectos',
      register_error: 'Error al registrarse. Intentá de nuevo.',
    },

    // Roles
    roles: {
      select: '¿Cómo vas a usar Laburar?',
      worker: 'Soy trabajador',
      worker_desc: 'Ofrezco mis servicios',
      employer: 'Busco un servicio',
      employer_desc: 'Necesito contratar a alguien',
      company: 'Soy empresa',
      company_desc: 'Busco empleados para mi empresa',
    },

    // Navegación
    nav: {
      home: 'Inicio',
      search: 'Buscar',
      concursa: 'Concursa',
      messages: 'Mensajes',
      profile: 'Perfil',
    },

    // Home
    home: {
      good_morning: 'Buenos días',
      good_afternoon: 'Buenas tardes',
      good_evening: 'Buenas noches',
      my_profile: 'Mi perfil',
      active: 'Activo',
      inactive: 'Inactivo',
      days_remaining: 'días restantes',
      views: 'Vistas',
      contacts: 'Contactos',
      for_you: 'Para vos',
      contests: 'llamados',
      contests_title: 'Concursos para tu perfil',
      closes_in: 'Cierra en',
      days: 'días',
      match: 'match',
      activate_profile: 'Activá tu perfil',
      profile_expired: 'Tu perfil venció',
      renew_profile: 'Renovar perfil',
    },

    // Búsqueda
    search: {
      title: '¿Qué necesitás?',
      subtitle: 'Encontrá a la persona ideal cerca tuyo',
      placeholder: 'Niñera, plomero, limpieza...',
      results: 'resultados en',
      no_results: 'No encontramos resultados para tu búsqueda',
      verified: '✓ Verificado',
      available: 'Disponible',
      years_exp: 'años de exp.',
      contact_for: 'Contactar por',
      categories: {
        nanny: 'Niñera',
        cleaning: 'Limpieza',
        plumber: 'Plomero',
        electrician: 'Electricista',
        garden: 'Jardín',
        driver: 'Chofer',
        cook: 'Cocinero/a',
        security: 'Seguridad',
        elderly_care: 'Cuidado de ancianos',
        animals: 'Animales',
        rural: 'Campo',
        construction: 'Construcción',
        sewing: 'Costura',
        shoemaker: 'Zapatero',
        butler: 'Portería',
        waiter: 'Mozo/a',
        stocker: 'Reponedor',
        lawn: 'Cortador de césped',
        trucker: 'Camionero',
        bodyguard: 'Custodia',
        maid: 'Mucama',
        watchman: 'Sereno',
        other: 'Otros',
      },
    },

    // Perfil trabajador
    profile: {
      title: 'Mi Perfil',
      edit_profile: 'Editar perfil',
      full_name: 'Nombre completo',
      bio: 'Descripción',
      category: 'Categoría de trabajo',
      experience: 'Experiencia',
      education: 'Formación',
      languages: 'Idiomas',
      certifications: 'Certificaciones y cursos',
      zone: 'Zona de trabajo',
      change_zone: 'Cambiar zona',
      availability: 'Disponibilidad',
      immediate: 'Inmediata',
      from_date: 'Desde fecha',
      preferences: 'Preferencias de trabajo',
      job_type: 'Tipo de empleo',
      permanent: 'Permanente',
      temporary: 'Temporal',
      per_task: 'Por tarea',
      hourly_rate: 'Remuneración esperada',
      hours: 'Carga horaria',
      always_visible: 'Perfil siempre visible para empresas',
      always_visible_desc: 'Las empresas podrán ver tu perfil completo sin necesidad de pagar por el contacto',
      doc_warning: 'Deberás presentar documentación que certifique los títulos, oficios e idiomas declarados si el empleador lo requiere.',
      rating: 'Valoración',
      no_ratings: 'Sin valoraciones aún',
      share_profile: 'Compartir perfil',
    },

    // Pagos
    payment: {
      activate_title: 'Activá tu perfil',
      activate_subtitle: 'Quedás visible para todo el mundo durante 2 meses completos.',
      total: 'Total a pagar',
      peso_equiv: '~$39 pesos · Una sola vez',
      include_title: 'Incluye:',
      include_1: 'Perfil visible 2 meses',
      include_2: 'Aparecés en búsquedas por zona',
      include_3: 'Notificación cuando te ven',
      include_4: 'Alertas de Concursa incluidas',
      how_pay: '¿Cómo querés pagar?',
      cell_balance: 'Saldo celular',
      card: 'Tarjeta',
      mercadopago: 'MercadoPago',
      abitab: 'Abitab / RedPagos',
      cell_unavailable: 'No disponible en tu país',
      no_auto: 'Sin suscripción automática',
      recurring: 'Activación recurrente',
      recurring_desc: 'Te avisamos cuando tu perfil esté por vencer para que lo renueves vos',
      activate_btn: '⚡ Activar por U$1',
      contact_btn: 'Contactar por U$1',
      success_title: '¡Perfil activado! ✓',
      success_msg: 'Tu perfil estará visible durante 2 meses completos.',
    },

    // Concursa
    concursa: {
      title: 'Concursa',
      powered: 'Powered by Laburar',
      main_title: 'Llamados públicos que encajan con vos',
      desc: 'Cruzamos tu CV con cada llamado abierto y te avisamos cuando cumplís los requisitos',
      for_you: 'Para vos',
      open: 'Abiertos',
      closing_soon: 'Cierran pronto',
      match_title: 'Tu perfil encaja con',
      calls: 'llamados',
      based_on: 'Basado en tu CV · Hoy',
      compatible: 'COMPATIBLES ✓',
      meets_all: '✓ Cumplís todos los requisitos',
      missing_req: '⚠ Te falta',
      requirement: 'requisito',
      new_today: 'Nuevo hoy',
      closes: 'Cierra:',
      apply: 'Postularme →',
      details: 'Ver detalles',
      alerts: '🔔 Alertas',
    },

    // Mensajes
    messages: {
      title: 'Mensajes',
      no_messages: 'Sin mensajes todavía',
      no_messages_desc: 'Cuando alguien te contacte, los mensajes aparecen acá.',
      type_message: 'Escribí un mensaje...',
      send: 'Enviar',
    },

    // Denuncias
    report: {
      title: 'Denunciar',
      subtitle: '¿Por qué querés denunciar este perfil?',
      fake_profile: 'Perfil falso',
      scam: 'Estafa o intento de fraude',
      inappropriate: 'Contenido inapropiado',
      abuse: 'Mal uso de la app',
      harassment: 'Acoso o amenazas',
      other: 'Otro motivo',
      details: 'Contanos más detalles (opcional)',
      submit: 'Enviar denuncia',
      success: 'Denuncia enviada. La revisaremos a la brevedad.',
    },

    // Ajustes
    settings: {
      title: 'Configuración',
      language: 'Idioma',
      biometrics: 'Acceso con huella / Face ID',
      notifications: 'Notificaciones',
      privacy: 'Privacidad',
      terms: 'Términos y Condiciones',
      help: 'Ayuda',
      contact_support: 'Contactar soporte',
      share_app: 'Compartir Laburar',
      logout: 'Cerrar sesión',
      version: 'Versión',
      account: 'Cuenta',
      delete_account: 'Eliminar cuenta',
    },

    // Ayuda
    help: {
      title: 'Ayuda',
      faq: 'Preguntas frecuentes',
      contact: 'Contactar soporte',
      chat: 'Chat con soporte',
      email_support: 'soporte@laburar.com',
    },

    // Compartir
    share_app: {
      message: '¡Encontrá trabajo o contratá al mejor profesional con Laburar! Descargala gratis en',
    },

    // Valoraciones
    ratings: {
      title: 'Valorar trabajador',
      subtitle: '¿Cómo fue tu experiencia?',
      comment: 'Comentario (opcional)',
      submit: 'Enviar valoración',
      success: 'Valoración enviada. ¡Gracias!',
    },

    // Errores
    errors: {
      network: 'Sin conexión a internet',
      server: 'Error del servidor. Intentá de nuevo.',
      not_found: 'No encontrado',
      unauthorized: 'Sesión expirada. Iniciá sesión de nuevo.',
    },
  },

  // ════════════════════════════
  // PORTUGUÊS
  // ════════════════════════════
  pt: {
    app_name: 'Laburar',
    loading: 'Carregando...',
    error_generic: 'Algo deu errado. Tente novamente.',
    cancel: 'Cancelar',
    save: 'Salvar',
    continue: 'Continuar',
    back: 'Voltar',
    yes: 'Sim',
    no: 'Não',
    ok: 'OK',
    close: 'Fechar',
    search: 'Buscar',
    filter: 'Filtrar',
    see_all: 'Ver tudo',
    required: 'Campo obrigatório',
    optional: 'Opcional',
    share: 'Compartilhar',
    report: 'Denunciar',
    contact: 'Contatar',
    edit: 'Editar',
    delete: 'Excluir',
    confirm: 'Confirmar',

    auth: {
      login: 'Entrar',
      register: 'Cadastrar-se',
      email: 'E-mail',
      password: 'Senha',
      confirm_password: 'Confirmar senha',
      forgot_password: 'Esqueceu sua senha?',
      reset_password: 'Redefinir senha',
      login_google: 'Continuar com Google',
      login_apple: 'Continuar com Apple',
      login_biometric: 'Entrar com impressão digital',
      login_biometric_face: 'Entrar com Face ID',
      no_account: 'Não tem conta? Cadastre-se',
      have_account: 'Já tem conta? Entre',
      terms_agree: 'Ao continuar você aceita nossos',
      terms_link: 'Termos e Condições',
      privacy_link: 'Política de Privacidade',
      terms_and: 'e a',
      email_placeholder: 'seu@email.com',
      password_placeholder: 'Mínimo 8 caracteres',
      password_mismatch: 'As senhas não coincidem',
      email_invalid: 'E-mail inválido',
      password_short: 'A senha deve ter pelo menos 8 caracteres',
      login_error: 'E-mail ou senha incorretos',
      register_error: 'Erro ao cadastrar. Tente novamente.',
    },

    roles: {
      select: 'Como vai usar o Laburar?',
      worker: 'Sou trabalhador',
      worker_desc: 'Ofereço meus serviços',
      employer: 'Procuro um serviço',
      employer_desc: 'Preciso contratar alguém',
      company: 'Sou empresa',
      company_desc: 'Procuro funcionários para minha empresa',
    },

    nav: {
      home: 'Início',
      search: 'Buscar',
      concursa: 'Concursos',
      messages: 'Mensagens',
      profile: 'Perfil',
    },

    home: {
      good_morning: 'Bom dia',
      good_afternoon: 'Boa tarde',
      good_evening: 'Boa noite',
      my_profile: 'Meu perfil',
      active: 'Ativo',
      inactive: 'Inativo',
      days_remaining: 'dias restantes',
      views: 'Visualizações',
      contacts: 'Contatos',
      for_you: 'Para você',
      contests: 'vagas',
      contests_title: 'Concursos para seu perfil',
      closes_in: 'Fecha em',
      days: 'dias',
      match: 'compatível',
      activate_profile: 'Ative seu perfil',
      profile_expired: 'Seu perfil expirou',
      renew_profile: 'Renovar perfil',
    },

    search: {
      title: 'O que você precisa?',
      subtitle: 'Encontre a pessoa ideal perto de você',
      placeholder: 'Babá, encanador, limpeza...',
      results: 'resultados em',
      no_results: 'Não encontramos resultados para sua busca',
      verified: '✓ Verificado',
      available: 'Disponível',
      years_exp: 'anos de exp.',
      contact_for: 'Contatar por',
      categories: {
        nanny: 'Babá',
        cleaning: 'Limpeza',
        plumber: 'Encanador',
        electrician: 'Eletricista',
        garden: 'Jardinagem',
        driver: 'Motorista',
        cook: 'Cozinheiro/a',
        security: 'Segurança',
        elderly_care: 'Cuidado de idosos',
        animals: 'Animais',
        rural: 'Campo',
        construction: 'Construção',
        sewing: 'Costura',
        shoemaker: 'Sapateiro',
        butler: 'Portaria',
        waiter: 'Garçom/Garçonete',
        stocker: 'Repositor',
        lawn: 'Corte de grama',
        trucker: 'Caminhoneiro',
        bodyguard: 'Segurança pessoal',
        maid: 'Camareira',
        watchman: 'Vigia',
        other: 'Outros',
      },
    },

    payment: {
      activate_title: 'Ative seu perfil',
      activate_subtitle: 'Você ficará visível para todos por 2 meses completos.',
      total: 'Total a pagar',
      peso_equiv: '~R$5 · Uma única vez',
      include_title: 'Inclui:',
      include_1: 'Perfil visível por 2 meses',
      include_2: 'Você aparece nas buscas por região',
      include_3: 'Notificação quando te visualizarem',
      include_4: 'Alertas de vagas incluídos',
      how_pay: 'Como quer pagar?',
      cell_balance: 'Saldo do celular',
      card: 'Cartão',
      mercadopago: 'MercadoPago',
      abitab: 'Boleto / Lotérica',
      cell_unavailable: 'Não disponível no seu país',
      no_auto: 'Sem assinatura automática',
      recurring: 'Ativação recorrente',
      recurring_desc: 'Te avisamos quando seu perfil estiver prestes a expirar para você renovar',
      activate_btn: '⚡ Ativar por U$1',
      contact_btn: 'Contatar por U$1',
      success_title: 'Perfil ativado! ✓',
      success_msg: 'Seu perfil ficará visível por 2 meses completos.',
    },

    messages: {
      title: 'Mensagens',
      no_messages: 'Sem mensagens ainda',
      no_messages_desc: 'Quando alguém te contatar, as mensagens aparecerão aqui.',
      type_message: 'Escreva uma mensagem...',
      send: 'Enviar',
    },

    report: {
      title: 'Denunciar',
      subtitle: 'Por que quer denunciar este perfil?',
      fake_profile: 'Perfil falso',
      scam: 'Golpe ou tentativa de fraude',
      inappropriate: 'Conteúdo inapropriado',
      abuse: 'Uso indevido do aplicativo',
      harassment: 'Assédio ou ameaças',
      other: 'Outro motivo',
      details: 'Conte mais detalhes (opcional)',
      submit: 'Enviar denúncia',
      success: 'Denúncia enviada. Analisaremos em breve.',
    },

    settings: {
      title: 'Configurações',
      language: 'Idioma',
      biometrics: 'Acesso com impressão digital / Face ID',
      notifications: 'Notificações',
      privacy: 'Privacidade',
      terms: 'Termos e Condições',
      help: 'Ajuda',
      contact_support: 'Contatar suporte',
      share_app: 'Compartilhar Laburar',
      logout: 'Sair',
      version: 'Versão',
      account: 'Conta',
      delete_account: 'Excluir conta',
    },

    errors: {
      network: 'Sem conexão com a internet',
      server: 'Erro no servidor. Tente novamente.',
      not_found: 'Não encontrado',
      unauthorized: 'Sessão expirada. Entre novamente.',
    },
  },

  // ════════════════════════════
  // ENGLISH
  // ════════════════════════════
  en: {
    app_name: 'Laburar',
    loading: 'Loading...',
    error_generic: 'Something went wrong. Please try again.',
    cancel: 'Cancel',
    save: 'Save',
    continue: 'Continue',
    back: 'Back',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    close: 'Close',
    search: 'Search',
    filter: 'Filter',
    see_all: 'See all',
    required: 'Required field',
    optional: 'Optional',
    share: 'Share',
    report: 'Report',
    contact: 'Contact',
    edit: 'Edit',
    delete: 'Delete',
    confirm: 'Confirm',

    auth: {
      login: 'Log in',
      register: 'Sign up',
      email: 'Email',
      password: 'Password',
      confirm_password: 'Confirm password',
      forgot_password: 'Forgot your password?',
      reset_password: 'Reset password',
      login_google: 'Continue with Google',
      login_apple: 'Continue with Apple',
      login_biometric: 'Log in with fingerprint',
      login_biometric_face: 'Log in with Face ID',
      no_account: "Don't have an account? Sign up",
      have_account: 'Already have an account? Log in',
      terms_agree: 'By continuing you agree to our',
      terms_link: 'Terms and Conditions',
      privacy_link: 'Privacy Policy',
      terms_and: 'and our',
      email_placeholder: 'you@email.com',
      password_placeholder: 'Minimum 8 characters',
      password_mismatch: 'Passwords do not match',
      email_invalid: 'Invalid email',
      password_short: 'Password must be at least 8 characters',
      login_error: 'Incorrect email or password',
      register_error: 'Error signing up. Please try again.',
    },

    roles: {
      select: 'How will you use Laburar?',
      worker: "I'm a worker",
      worker_desc: 'I offer my services',
      employer: "I'm looking for a service",
      employer_desc: 'I need to hire someone',
      company: "I'm a company",
      company_desc: "I'm looking for employees",
    },

    nav: {
      home: 'Home',
      search: 'Search',
      concursa: 'Jobs',
      messages: 'Messages',
      profile: 'Profile',
    },

    home: {
      good_morning: 'Good morning',
      good_afternoon: 'Good afternoon',
      good_evening: 'Good evening',
      my_profile: 'My profile',
      active: 'Active',
      inactive: 'Inactive',
      days_remaining: 'days remaining',
      views: 'Views',
      contacts: 'Contacts',
      for_you: 'For you',
      contests: 'openings',
      contests_title: 'Job openings for your profile',
      closes_in: 'Closes in',
      days: 'days',
      match: 'match',
      activate_profile: 'Activate your profile',
      profile_expired: 'Your profile has expired',
      renew_profile: 'Renew profile',
    },

    payment: {
      activate_title: 'Activate your profile',
      activate_subtitle: "You'll be visible to everyone for 2 full months.",
      total: 'Total to pay',
      peso_equiv: '~$1 USD · One time only',
      include_title: 'Includes:',
      include_1: 'Profile visible for 2 months',
      include_2: 'You appear in nearby searches',
      include_3: 'Notification when someone views you',
      include_4: 'Job alerts included',
      how_pay: 'How do you want to pay?',
      cell_balance: 'Cell phone balance',
      card: 'Credit/Debit card',
      mercadopago: 'MercadoPago',
      abitab: 'Cash payment',
      cell_unavailable: 'Not available in your country',
      no_auto: 'No automatic subscription',
      recurring: 'Recurring activation',
      recurring_desc: "We'll remind you when your profile is about to expire so you can renew it",
      activate_btn: '⚡ Activate for $1',
      contact_btn: 'Contact for $1',
      success_title: 'Profile activated! ✓',
      success_msg: 'Your profile will be visible for 2 full months.',
    },

    messages: {
      title: 'Messages',
      no_messages: 'No messages yet',
      no_messages_desc: "When someone contacts you, messages will appear here.",
      type_message: 'Write a message...',
      send: 'Send',
    },

    report: {
      title: 'Report',
      subtitle: 'Why do you want to report this profile?',
      fake_profile: 'Fake profile',
      scam: 'Scam or fraud attempt',
      inappropriate: 'Inappropriate content',
      abuse: 'App misuse',
      harassment: 'Harassment or threats',
      other: 'Other reason',
      details: 'Tell us more details (optional)',
      submit: 'Submit report',
      success: "Report submitted. We'll review it shortly.",
    },

    settings: {
      title: 'Settings',
      language: 'Language',
      biometrics: 'Fingerprint / Face ID access',
      notifications: 'Notifications',
      privacy: 'Privacy',
      terms: 'Terms and Conditions',
      help: 'Help',
      contact_support: 'Contact support',
      share_app: 'Share Laburar',
      logout: 'Log out',
      version: 'Version',
      account: 'Account',
      delete_account: 'Delete account',
    },

    errors: {
      network: 'No internet connection',
      server: 'Server error. Please try again.',
      not_found: 'Not found',
      unauthorized: 'Session expired. Please log in again.',
    },
  },
};

// ── Instancia de i18n ──
const i18n = new I18n(translations);

// Detectar idioma del dispositivo automáticamente
const deviceLocale = getLocales()[0]?.languageCode ?? 'es';

// Mapear idioma detectado a los disponibles
function getAvailableLocale(locale) {
  if (locale.startsWith('pt')) return 'pt';
  if (locale.startsWith('en')) return 'en';
  return 'es'; // default español
}

i18n.locale = getAvailableLocale(deviceLocale);
i18n.enableFallback = true;
i18n.defaultLocale = 'es';

// ── Función para cambiar idioma manualmente ──
export function setLocale(locale) {
  i18n.locale = locale;
}

// ── Función de traducción ──
export function t(key, options) {
  return i18n.t(key, options);
}

// ── Idioma actual ──
export function getCurrentLocale() {
  return i18n.locale;
}

// ── Idiomas disponibles ──
export const AVAILABLE_LANGUAGES = [
  { code: 'es', label: 'Español',    flag: '🇺🇾' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'en', label: 'English',    flag: '🇺🇸' },
];

export default i18n;
