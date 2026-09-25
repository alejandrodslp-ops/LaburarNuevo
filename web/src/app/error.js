'use client'

export default function Error({ error, reset }) {
  return (
    <div style={{
      minHeight: '70vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '40px 24px', background: '#FBF8F4',
    }}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>😕</div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1020', marginBottom: 8 }}>
        Algo salió mal
      </h1>
      <p style={{ fontSize: 14, color: '#5A4E6A', maxWidth: 380, marginBottom: 28, lineHeight: 1.6 }}>
        No es culpa tuya — pasó un error inesperado cargando esta página. Probá de nuevo.
      </p>
      <button
        onClick={reset}
        style={{
          background: 'var(--coral-cta, #C2502F)', color: '#fff', border: 'none',
          borderRadius: 10, padding: '13px 28px', fontSize: 15, fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        Reintentar
      </button>
    </div>
  )
}
