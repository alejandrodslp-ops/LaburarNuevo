// Detecta cuando alguien escribe un DESEO/frase ("un buen clima laboral y un
// buen salario") en vez de un puesto u oficio ("administrativa", "vendedor").
//
// Criterio de diseño (2026-08-15): alta precisión, baja molestia. Dispara SOLO
// por "palabras de expectativa" — lo que la persona quiere DEL trabajo — que casi
// nunca aparecen en el nombre de un puesto real. NO dispara por verbos de búsqueda
// ("busco vendedor" es válido) ni por longitud sola (un título largo real como
// "Coordinador de administración de personal" no debe marcarse). Ante la duda,
// se prefiere NO marcar.
//
// Se usa en dos lugares con la MISMA lista: el formulario web (aviso suave) y la
// función de alertas (correo único a los ya anotados). Mantener ambas en sync.

const PALABRAS_DESEO = new Set([
  'salario', 'salarios', 'sueldo', 'sueldos', 'paga', 'remuneracion', 'remunerado',
  'ambiente', 'clima', 'estable', 'estabilidad', 'tranquilo', 'tranquila', 'tranquilidad',
  // "trato" quitada 2026-08-15: falso-positiveaba "Cuidador trato directo" (oficio real).
  'comodo', 'crecimiento', 'crecer', 'oportunidad', 'oportunidades', 'respeto',
  'buen', 'buena', 'bueno', 'buenos', 'buenas', 'mejor', 'cerca',
])

function aPalabras(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

// true = parece un deseo/frase, no un oficio. Conservador: si hay dudas, false.
export function pareceDeseo(texto) {
  const palabras = aPalabras(texto)
  if (palabras.length === 0) return false
  return palabras.some((w) => PALABRAS_DESEO.has(w))
}
