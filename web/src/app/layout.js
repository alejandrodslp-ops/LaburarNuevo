import './globals.css'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://nexu.app'

export const metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Nexu — Concursos y empleos en LatAm',
    template: '%s | Nexu',
  },
  description:
    'Encontrá concursos y llamados de trabajo en Uruguay, Argentina y toda LatAm. Registrate gratis y recibí alertas personalizadas para tu perfil.',
  openGraph: {
    title: 'Nexu — Concursos y empleos en LatAm',
    description: 'Encontrá concursos y llamados de trabajo en Uruguay, Argentina y toda LatAm. Gratis.',
    url: '/',
    siteName: 'Nexu',
    locale: 'es_UY',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@nexuapp',
    title: 'Nexu — Concursos y empleos en LatAm',
    description: 'Concursos públicos y llamados de trabajo en Uruguay, Argentina y toda LatAm. Gratis.',
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.ico' },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Nexu',
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
      </body>
    </html>
  )
}
