export default function Loading() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#EFE8D8',
        color: '#0F3D2E',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="animate-pulse" style={{ textAlign: 'center' }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          DripCheck
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#5B5F52' }}>Styling your screen…</p>
      </div>
    </div>
  )
}
