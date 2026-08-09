'use client'
import { useEffect } from 'react'

// Corrige el <html lang> según el idioma real de la página. El layout raíz es
// estático y fija lang="es" para todo el sitio; en páginas en otro idioma
// (ej. Brasil = pt) eso es una señal contradictoria para buscadores, lectores
// de pantalla y el traductor del navegador. Este componente ajusta
// document.documentElement.lang tras la hidratación — SIN volver el sitio
// dinámico (cero costo extra en Vercel). Google renderiza JS y ve el lang
// corregido; el resto de consumidores también.
export default function SetHtmlLang({ lang }) {
  useEffect(() => {
    if (lang && document.documentElement.lang !== lang) {
      document.documentElement.lang = lang
    }
  }, [lang])
  return null
}
