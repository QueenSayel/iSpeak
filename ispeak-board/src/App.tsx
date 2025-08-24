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
import { useCollaboration } from './useCollaboration' // Import our new hook

// --- COMPONENTS (Unchanged) ---
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
        backgroundColor: 'white',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h2 
          style={{ 
            color: '#2b2d42',
            marginBottom: '2rem',
          }}
        >
          Loading...
        </h2>
        <img 
          src="/board/loader.gif" 
          alt="Loading animation"
          style={{
            transform: 'scale(0.5)',
          }}
        />
      </div>
    </div>
  )
}


export default function App() {
  const [editor, setEditor] = useState<Editor>()
  const [snapshot, setSnapshot] = useState<TLStoreSnapshot | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const path = window.location.pathname;
  const boardId = path.split('/board/b/')[1] || null;

  // --- 1. INITIAL LOAD (Unchanged) ---
  // This effect handles authentication and loading the board's initial state.
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
      setSnapshot(null);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from('boards')
          .select('content')
          .eq('id', boardId)
          .maybeSingle()

        if (error) throw error;

        if (data?.content) {
          setSnapshot(data.content)
        } else {
          setLoadError("You may not have access to this board, or it may not exist.");
          setSnapshot({} as TLStoreSnapshot);
        }
      } catch (error) {
        console.error('Failed to load board:', error)
        setLoadError("An unexpected error occurred while trying to load the board.");
        setSnapshot({} as TLStoreSnapshot);
      }
    }
    loadBoard()
  }, [boardId, isAuthLoading])

  const handleMount = useCallback((editor: Editor) => { setEditor(editor) }, [])

  // --- 2. LIVE COLLABORATION (NEW) ---
  // This single line activates our entire real-time system. It runs in parallel
  // to the persistence logic below.
  useCollaboration(editor, boardId);

  // --- 3. PERSISTENT SAVING (UNCHANGED) ---
  // We keep the debounced save to ensure the final state is always stored in the database.
  const debouncedSave = useDebouncedCallback((editorToSave: Editor) => {
    if (!boardId || loadError) return;

    const currentSnapshot = editorToSave.getSnapshot()
    supabase
      .from('boards')
      .upsert({ id: boardId, content: currentSnapshot })
      .then((response) => {
        if (response.error) {
          console.error('!!! Supabase Error saving board:', response.error)
        } else {
          console.log(`✅ Board ${boardId} saved successfully! (Persistence)`)
        }
      })
  }, 2000) // Increased debounce to 2s to reduce frequency of writes

  useEffect(() => {
    if (!editor) return

    // This listener is for persistence. It listens for ALL changes,
    // both local and remote, so that any user's inactivity can trigger a save.
    const unlisten = editor.store.listen(() => {
        debouncedSave(editor)
    }, { scope: 'document' })

    return () => unlisten()
  }, [editor, debouncedSave])


  // --- RENDERING LOGIC (Unchanged) ---
  if (isAuthLoading) {
    return <div style={{ position: 'fixed', inset: 0 }}><LoadingScreen /></div>;
  }

  if (!boardId) {
    return <MessageScreen title="No Board Selected" message="Please create or select a board from the admin or student dashboard." />;
  }
  
  if (loadError) {
    return <MessageScreen title="Access Denied or Board Not Found" message={loadError} />;
  }

  if (snapshot === null) {
    return <div style={{ position: 'fixed', inset: 0 }}><LoadingScreen /></div>
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
