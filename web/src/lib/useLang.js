'use client'
import { useEffect, useState } from 'react'

// Idioma auto por navegador (navigator.language pt-* → pt, resto → es).
// Requisito del usuario: el panel debe estar al menos en español y portugués.
// SSR arranca en 'es'; en el cliente pasa a 'pt' si el navegador es portugués.
// (Sin toggle: decisión del usuario — "solo auto por navegador".)
export function useLang() {
  const [lang, setLang] = useState('es')
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('pt')) setLang('pt')
  }, [])
  return lang
}
