// src/App.tsx

import {
  Tldraw,
  Editor,
  // 'assetCreateOverride' has been removed
} from 'tldraw'
import type { TLStoreSnapshot } from 'tldraw' // We no longer need TLAsset here

import 'tldraw/tldraw.css'
import { useCallback, useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { supabase } from './supabaseClient'

const BOARD_ID = 'my-first-board'

// The 'myOverrides' constant has been completely removed.

function LoadingScreen() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
      }}
    >
      <h2>Loading Board...</h2>
    </div>
  )
}

export default function App() {
  const [editor, setEditor] = useState<Editor>()
  const [snapshot, setSnapshot] = useState<TLStoreSnapshot | null>(null)

  useEffect(() => {
    supabase
      .from('boards')
      .select('content')
      .eq('id', BOARD_ID)
      .then(({ data }) => {
        if (data?.[0]?.content) {
          setSnapshot(data[0].content)
        } else {
          setSnapshot({} as TLStoreSnapshot)
        }
      })
      .catch((error: any) => {
        console.error(error)
        setSnapshot({} as TLStoreSnapshot)
      })
  }, [])

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor)
  }, [])

  const debouncedSave = useDebouncedCallback((editorToSave: Editor) => {
    const startTime = new Date()
    console.log(`--- EXECUTING SAVE LOGIC NOW --- at ${startTime.toLocaleTimeString()}`)

    const currentSnapshot = editorToSave.getSnapshot()

    supabase
      .from('boards')
      .upsert({ id: BOARD_ID, content: currentSnapshot })
      .then((response) => {
        if (response.error) {
          console.error('!!! Supabase Error saving board:', response.error)
        } else {
          const endTime = new Date()
          const duration = endTime.getTime() - startTime.getTime()
          console.log(`✅ Board saved successfully! at ${endTime.toLocaleTimeString()} (took ${duration}ms)`)
        }
      })
  }, 500)

  useEffect(() => {
    if (!editor) return

    const unlisten = editor.store.listen(() => {
      debouncedSave(editor)
    }, { scope: 'document' })

    return () => unlisten()
  }, [editor, debouncedSave])

  if (snapshot === null) {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <LoadingScreen />
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        // The 'overrides' prop has been removed
        snapshot={snapshot}
        onMount={handleMount}
        autoFocus
      />
    </div>
  )
}
