// Self-contained fallback screen. Uses literal palette values so it still
// looks right even if global CSS fails to load (that is exactly when you need
// an error boundary).

interface SystemScreenProps {
  eyebrow?: string
  title: string
  body: string
  action?: React.ReactNode
}

export default function SystemScreen({ eyebrow = 'DripCheck', title, body, action }: SystemScreenProps) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#EFE8D8',
        color: '#10241C',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#F7F2E6',
          border: '1px solid rgba(16,36,28,.16)',
          borderRadius: 16,
          padding: 28,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: '#0F3D2E',
          }}
        >
          {eyebrow}
        </p>
        <h1 style={{ margin: '10px 0 8px', fontSize: 30, lineHeight: 1.05 }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: '#5B5F52' }}>{body}</p>
        {action ? <div style={{ marginTop: 20 }}>{action}</div> : null}
      </div>
    </main>
  )
}

export const systemButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  minHeight: 44,
  padding: '0 20px',
  borderRadius: 999,
  border: 'none',
  background: '#0F3D2E',
  color: '#EFE8D8',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
}
