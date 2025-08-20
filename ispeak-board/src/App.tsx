// src/App.tsx

import {
  Tldraw,
  Editor,
} from 'tldraw'
import type { TLStoreSnapshot } from 'tldraw'

import 'tldraw/tldraw.css'
import { useCallback, useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { supabase } from './supabaseClient'

const BOARD_ID = 'my-first-board'

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

  // This useEffect has been rewritten to use async/await
  useEffect(() => {
    // We define an async function inside the effect
    const loadBoard = async () => {
      try {
        // We 'await' the result of the Supabase query
        const { data } = await supabase
          .from('boards')
          .select('content')
          .eq('id', BOARD_ID)
          .single() // .single() is a good practice when you expect one row

        if (data?.content) {
          setSnapshot(data.content)
        } else {
          // If no data is found, we still treat it as a successful load of an empty board
          setSnapshot({} as TLStoreSnapshot)
        }
      } catch (error) {
        // Any error (network, etc.) is caught here
        console.error('Failed to load board:', error)
        // Ensure the app unblocks even if loading fails
        setSnapshot({} as TLStoreSnapshot)
      }
    }

    // We call the async function
    loadBoard()
  }, []) // The empty dependency array is correct, so this runs only once on mount

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
        snapshot={snapshot}
        onMount={handleMount}
        autoFocus
      />
    </div>
  )
}
