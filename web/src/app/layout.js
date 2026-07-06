import './globals.css'
import { Analytics } from '@vercel/analytics/next'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.konexu.app'

export const metadata = {
  metadataBase: new URL(SITE),
  verification: { google: '_SAuqYOvEejtcDQsVXJ0rDLXvBnTO-Yhr0cgiwO4B4g' },
  title: {
    default: 'Konexu — Concursos Públicos y Empleos en Uruguay, Argentina y LatAm',
    template: '%s | Konexu',
  },
  description:
    'Miles de concursos públicos, llamados de trabajo y vacantes en Uruguay, Argentina, Brasil y toda LatAm. Sector público y privado. Actualizados diariamente. Gratis.',
  keywords: [
    // Uruguay
    'concursos públicos Uruguay','llamados ONSC','Uruguay Concursa','empleos Uruguay',
    // Argentina
    'concursos públicos Argentina','empleos Argentina','trabajo Argentina','convocatorias Argentina',
    // Brasil (PT)
    'concurso público Brasil','empregos Brasil','vagas Brasil','concurso público federal',
    // México
    'empleos México','convocatorias México','trabajo México','vacantes gobierno México',
    // Colombia
    'empleos Colombia','trabajo Colombia','convocatorias CNSC','empleo público Colombia',
    // Chile
    'empleos Chile','trabajo Chile','concursos públicos Chile',
    // Resto LatAm
    'trabajo América Latina','empleo público LatAm','concursos laborales',
    // Multilang
    'jobs Latin America','emplois Amérique latine','lavoro America Latina',
    'Jobs Lateinamerika','jobb Latinamerika',
    // Generic
    'vacantes gobierno','empleo público','public sector jobs',
  ],
  openGraph: {
    title: 'Konexu — Concursos Públicos y Empleos en Uruguay, Argentina y LatAm',
    description: 'Miles de concursos públicos y vacantes en Uruguay, Argentina, Brasil y toda LatAm. Actualizados diariamente. Gratis.',
    url: '/',
    siteName: 'Konexu',
    locale: 'es_UY',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Konexu — Concursos Públicos y Empleos en LatAm',
    description: 'Concursos públicos y empleos en Uruguay, Argentina y toda LatAm. Actualizados diariamente. Gratis.',
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.ico' },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Konexu',
  url: SITE,
  description: 'Concursos y empleos en Uruguay, Argentina y toda LatAm.',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/empleos?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
