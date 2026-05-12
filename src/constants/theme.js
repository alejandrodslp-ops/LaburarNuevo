// src/constants/theme.js
// Todos los colores y estilos de la app en un solo lugar
// Si querés cambiar un color, lo cambiás acá y cambia en toda la app

export const COLORS = {
  // ── COLORES PRINCIPALES ──
  coral:        '#FF5F40',   // El naranja-coral del logo
  coralDark:    '#F04830',   // Coral más oscuro (degradado)
  coralSoft:    '#FFF0ED',   // Coral muy suave (fondos)

  indigo:       '#0F766E',   // Teal oscuro (texto, borders)
  indigoBright: '#2DD4BF',   // Teal principal (botones, acento)
  indigoSoft:   '#F0FDFA',   // Teal muy suave (fondos)

  menta:        '#00C896',   // Verde menta (éxito, match)
  mentaDark:    '#00A07A',   // Menta oscuro
  mentaSoft:    '#E6FBF5',   // Menta suave

  arena:        '#2C1A0E',   // Marrón oscuro (card Concursa)
  arenaMid:     '#5C3D2A',

  gold:         '#F59E0B',   // Dorado (advertencias)
  goldSoft:     '#FFFBEB',

  // ── NEUTROS ──
  blanco:       '#FFFFFF',
  crema:        '#FBF8F4',   // Fondo general de la app
  cremaDark:    '#F2EDE6',
  borde:        '#EDE8E2',

  // ── TEXTOS ──
  texto1:       '#1A1020',   // Texto principal
  texto2:       '#5A4E6A',   // Texto secundario
  texto3:       '#A898B8',   // Texto suave / placeholders

  // ── LOGO ──
  slate:        '#607878',   // Gris teal del recuadro del logo
  slateDark:    '#4A6868',
  slateLight:   '#7A9898',
};

export const FONTS = {
  // Usamos el sistema de fuentes del dispositivo
  // Para Outfit necesitás cargarlo con expo-font
  regular:   'Outfit-Regular',
  medium:    'Outfit-Medium',
  semibold:  'Outfit-SemiBold',
  bold:      'Outfit-Bold',
  extrabold: 'Outfit-ExtraBold',
};

export const SIZES = {
  // Espaciados
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,

  // Bordes
  radiusSm:   8,
  radiusMd:   14,
  radiusLg:   20,
  radiusXl:   28,
  radiusFull: 999,

  // Textos
  textXs:   10,
  textSm:   12,
  textMd:   14,
  textLg:   16,
  textXl:   20,
  text2xl:  24,
  text3xl:  32,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};
