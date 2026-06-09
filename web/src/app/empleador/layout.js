'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabaseBrowser } from '../../lib/supabase-browser'

export default function EmpleadorLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (!data.user && pathname !== '/empleador/login') {
        router.replace('/empleador/login')
      }
    })
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user && pathname !== '/empleador/login') {
        router.replace('/empleador/login')
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [pathname])

  const isLogin = pathname === '/empleador/login'

  async function cerrarSesion() {
    await supabaseBrowser.auth.signOut()
    router.replace('/empleador/login')
  }

  if ((user === undefined || user === null) && !isLogin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--coral)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {!isLogin && (
        <nav style={{ background: 'var(--dark)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, zIndex: 100 }}>
          <a href="/empleador" style={{ display:'inline-flex', alignItems:'center', background:'#151c2c', border:'2px solid var(--coral)', borderRadius:12, padding:'4px 13px', color:'var(--coral)', fontWeight:900, fontSize:20, letterSpacing:'-0.5px', textDecoration:'none' }}>Nexu<span style={{fontSize:'0.72em',marginLeft:'1px',verticalAlign:'sub'}}>🧩</span></a>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <NavLink href="/empleador" label="Dashboard" pathname={pathname} />
            <NavLink href="/empleador/ofertas" label="Mis ofertas" pathname={pathname} />
            <NavLink href="/empleador/candidatos" label="Candidatos" pathname={pathname} />
            <button onClick={cerrarSesion} style={{ marginLeft: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>
              Salir
            </button>
          </div>
        </nav>
      )}
      {children}
    </div>
  )
}

function NavLink({ href, label, pathname }) {
  const active = pathname === href || (href !== '/empleador' && pathname.startsWith(href))
  return (
    <a href={href} style={{ color: active ? 'var(--coral)' : 'rgba(255,255,255,0.7)', fontWeight: active ? 700 : 500, fontSize: 14, padding: '6px 12px', borderRadius: 8, background: active ? 'rgba(232,120,90,0.12)' : 'transparent' }}>
      {label}
    </a>
  )
}
