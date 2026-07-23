import { Component } from 'react'

/* Render-crash containment. Two real white-screens have shipped
   (Invalid-Date in the week meta; a loadStr JSON mismatch) — a crash
   must degrade to a readable terminal fault screen, never a blank
   page. Personal data is untouched: localStorage and the cloud store
   are not involved in rendering. */
export default class TermBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    const msg = String(this.state.error?.message || this.state.error || 'unknown fault')
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0908', color: '#ece3d0',
        fontFamily: "Consolas, 'Inconsolata', ui-monospace, monospace",
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center',
      }}>
        <div style={{ color: '#ff4e00', fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>
          &gt;<span style={{ display: 'inline-block', width: 14, height: 7, background: '#c6f226', marginLeft: 8 }} />
        </div>
        <div style={{ color: '#ffab00', letterSpacing: 3, fontSize: 14, fontWeight: 700 }}>
          TERMINAL FAULT
        </div>
        <div style={{ color: '#7d7565', fontSize: 12, maxWidth: 520, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
          {msg}
        </div>
        <div style={{ color: '#7d7565', fontSize: 11 }}>
          Your data is safe — this is a display fault only.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'none', border: '1px solid #3a362e', color: '#ffab00',
            font: 'inherit', fontSize: 13, letterSpacing: 2, padding: '10px 22px',
            cursor: 'pointer', fontWeight: 700,
          }}
        >
          RELOAD
        </button>
      </div>
    )
  }
}
