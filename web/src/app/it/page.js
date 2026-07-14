import { createClient } from '@supabase/supabase-js'
import LandingIntl from '../../components/LandingIntl'
import { LANDINGS } from '../../lib/landing-i18n'

export const revalidate = 300
export const fetchCache = 'force-no-store'

const LANG = 'it'
const t = LANDINGS[LANG]
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const metadata = {
  title: t.title,
  description: t.description,
  alternates: { canonical: '/it', languages: { 'es': '/', 'pt-BR': '/pt', 'en': '/en', 'fr': '/fr', 'it': '/it', 'de': '/de', 'sv': '/sv', 'no': '/no', 'ja': '/ja' } },
  openGraph: { title: t.og_title, description: t.og_desc, url: '/it', siteName: 'Konexu', locale: t.locale, type: 'website', images: [{ url: '/og-konexu-it.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: t.og_title, description: t.og_desc, images: ['/og-konexu-it.png'] },
  robots: { index: true, follow: true },
}

export default async function Page() {
  const [{ data: total }, { data: jobs }] = await Promise.all([
    db.rpc('count_concursos_activos'),
    db.from('concursos')
      .select('id,titulo,cargo,organismo,pais,lugar,fecha_cierre,tipo_vinculo,tipo_tarea,puestos,created_at')
      .eq('activo', true).in('pais', t.pais_codes)
      .order('created_at', { ascending: false }).limit(8),
  ])
  return <LandingIntl lang={LANG} t={t} total={total ?? 0} jobs={jobs ?? []} />
}
