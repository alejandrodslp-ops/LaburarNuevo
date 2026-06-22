const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://kokonexu.app'

export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE}/sitemap.xml`,
  }
}
