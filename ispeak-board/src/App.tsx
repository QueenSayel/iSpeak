// src/App.tsx

import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

// The tldraw component is a full-fledged editor.
// It takes up the full space of its parent container.
export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw />
    </div>
  )
}