'use client'
import { useState, useEffect } from 'react'

export default function CounterRealtime({ initialTotal, style }) {
  const [total, setTotal] = useState(initialTotal)

  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch('/api/count')
        if (!res.ok) return
        const { total: t } = await res.json()
        if (t > 0) setTotal(t)
      } catch {}
    }

    refresh()
    const interval = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return <span style={style}>{total.toLocaleString('es')}</span>
}
