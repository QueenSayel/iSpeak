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

// --- CHANGE 1: CREATE A NEW COMPONENT FOR ERROR MESSAGES ---
function MessageScreen({ title, message }: { title: string; message: string }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', backgroundColor: '#f4f4f4', fontFamily: 'sans-serif'
    }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: '#c53030' }}>{title}</h2>
          <p style={{ color: '#4a5568' }}>{message}</p>
      </div>
    </div>
  )
}


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
      <h2>Loading...</h2>
    </div>
  )
}

export default function App() {
  const [editor, setEditor] = useState<Editor>()
  const [snapshot, setSnapshot] = useState<TLStoreSnapshot | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // --- CHANGE 2: ADD NEW STATE TO TRACK LOADING ERRORS ---
  const [loadError, setLoadError] = useState<string | null>(null);

  const path = window.location.pathname;
  const boardId = path.split('/board/b/')[1] || null;

  useEffect(() => {
    const checkUserSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/board/login.html';
      } else {
        setIsAuthLoading(false);
      }
    };
    checkUserSession();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !boardId) {
      if (!boardId) {
        setSnapshot({} as TLStoreSnapshot);
      }
      return;
    }

    const loadBoard = async () => {
      setSnapshot(null); // Set to loading state
      setLoadError(null); // Reset any previous errors

      try {
        // --- CHANGE 3: MODIFIED QUERY TO CATCH "NOT FOUND" ---
        // We remove .single() to prevent it from throwing an error on zero rows.
        const { data, error } = await supabase
          .from('boards')
          .select('content')
          .eq('id', boardId)
          .maybeSingle() // Use .maybeSingle() which returns null instead of erroring on no rows

        if (error) throw error; // If there's a real database error, throw it to the catch block.

        if (data?.content) {
          // Success: we found the board and have access
          setSnapshot(data.content)
        } else {
          // This is the key: if data is null, the board was not found OR RLS blocked it.
          setLoadError("You may not have access to this board, or it may not exist.");
          setSnapshot({} as TLStoreSnapshot); // Unblock rendering, the error message will show.
        }
      } catch (error) {
        // This will catch network errors or other unexpected database issues.
        console.error('Failed to load board:', error)
        setLoadError("An unexpected error occurred while trying to load the board.");
        setSnapshot({} as TLStoreSnapshot); // Unblock rendering
      }
    }

    loadBoard()
  }, [boardId, isAuthLoading])

  // handleMount and debouncedSave remain the same
  const handleMount = useCallback((editor: Editor) => { setEditor(editor) }, [])
  const debouncedSave = useDebouncedCallback((editorToSave: Editor) => {
    if (!boardId || loadError) return; // Also, don't save if there was a load error.

    const currentSnapshot = editorToSave.getSnapshot()
    supabase
      .from('boards')
      .upsert({ id: boardId, content: currentSnapshot })
      .then((response) => {
        if (response.error) {
          console.error('!!! Supabase Error saving board:', response.error)
        } else {
          console.log(`✅ Board ${boardId} saved successfully!`)
        }
      })
  }, 1000)

  useEffect(() => {
    if (!editor) return
    const unlisten = editor.store.listen(() => { debouncedSave(editor) }, { scope: 'document' })
    return () => unlisten()
  }, [editor, debouncedSave])


  // --- CHANGE 4: UPDATED RENDER LOGIC ---

  // While checking for a logged-in user
  if (isAuthLoading) {
    return <div style={{ position: 'fixed', inset: 0 }}><LoadingScreen /></div>;
  }

  // If there is no board ID in the URL
  if (!boardId) {
    return <MessageScreen title="No Board Selected" message="Please create or select a board from the admin or student dashboard." />;
  }
  
  // NEW: If we detected an error while loading the board
  if (loadError) {
    return <MessageScreen title="Access Denied or Board Not Found" message={loadError} />;
  }

  // If we are still fetching the board's data
  if (snapshot === null) {
    return <div style={{ position: 'fixed', inset: 0 }}><LoadingScreen /></div>
  }

  // Finally, render the board if everything is successful
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
