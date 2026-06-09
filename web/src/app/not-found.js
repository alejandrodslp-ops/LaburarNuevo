import Link from 'next/link'

export default function NotFound() {
  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">Nexu<span style={{fontSize:"0.72em",marginLeft:"1px",verticalAlign:"sub"}}>🧩</span></Link>
      </nav>
      <div className="empty-state" style={{ paddingTop: 80 }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#1A3A5C', marginBottom: 8 }}>
          Este empleo ya no está disponible
        </p>
        <p style={{ marginBottom: 24 }}>
          Puede que haya vencido o que la posición ya fue cubierta.
        </p>
        <Link href="/empleos" className="btn-primary" style={{ display: 'inline-block' }}>
          Ver empleos disponibles →
        </Link>
      </div>
    </>
  )
}
