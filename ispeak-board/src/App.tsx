// src/App.tsx

import {
  Tldraw,
  Editor,
} from 'tldraw'
import type { TLStoreSnapshot } from 'tldraw'

import 'tldraw/tldraw.css'
import './App.css' // --- 1. IMPORT THE NEW CSS FILE ---
import { useCallback, useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { supabase } from './supabaseClient'
import { useCollaboration, type Awareness } from './useCollaboration'

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
        <h2 style={{ color: '#2b2d42', marginBottom: '2rem' }}>Loading...</h2>
        <img src="/board/loader.gif" alt="Loading animation" style={{ transform: 'scale(0.5)' }} />
      </div>
    </div>
  )
}

function BoardSwitcher({ currentBoardId }: { currentBoardId: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [boards, setBoards] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    const fetchAccessibleBoards = async () => {
      const { data, error } = await supabase
        .from('boards')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching board list:', error);
      } else {
        setBoards(data || []);
      }
    };
    fetchAccessibleBoards();
  }, []);

  return (
    // We add the 'expanded' class based on our state
    // and the mouse leave event to the container itself
    <div 
      className={`board-switcher ${isExpanded ? 'expanded' : ''}`}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* The mouse enter event is ONLY on the visible tab */}
	<div 
	  className="switcher-tab"
	  onMouseEnter={() => setIsExpanded(true)}
	>
	  <i className={`fa-solid ${isExpanded ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
	</div>
      <div className="switcher-panel">
        <h3>Your Boards</h3>
        <ul>
          {boards.length > 0 ? (
            boards.map(board => (
              <li key={board.id}>
                <a 
                  href={`/board/b/${board.id}`}
                  className={board.id === currentBoardId ? 'active' : ''}
                >
                  {board.name}
                </a>
              </li>
            ))
          ) : (
            <li>No boards accessible.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function LiveUsers({ users }: { users: Awareness[] }) {
  const [isHovered, setIsHovered] = useState(false);

  if (users.length === 0) return null;

  return (
    <div
      className="live-users-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="live-users-bar">
        <i className="fa-solid fa-users"></i>
        <span>Live Users ({users.length})</span>
      </div>

      {isHovered && (
        <div className="live-users-dropdown">
          {users.map((user) => (
            <div key={user.id} className="user-entry">
              <div className="user-avatar" style={{ backgroundColor: user.color }}>
                {user.name.substring(0, 2).toUpperCase()}
              </div>
              <span className="user-name">{user.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


export default function App() {
  const [editor, setEditor] = useState<Editor>()
  const [snapshot, setSnapshot] = useState<TLStoreSnapshot | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true);
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
      setSnapshot(null);
      setLoadError(null);
      try {
        const { data, error } = await supabase.from('boards').select('content').eq('id', boardId).maybeSingle()
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

  const { collaborators } = useCollaboration(editor, boardId);

  const debouncedSave = useDebouncedCallback((editorToSave: Editor) => {
    if (!boardId || loadError) return;
    const currentSnapshot = editorToSave.getSnapshot()
    supabase.from('boards').upsert({ id: boardId, content: currentSnapshot })
      .then((response) => {
        if (response.error) {
          console.error('!!! Supabase Error saving board:', response.error)
        } else {
          console.log(`✅ Board ${boardId} saved successfully! (Persistence)`)
        }
      })
  }, 2000)

  useEffect(() => {
    if (!editor) return
    const unlisten = editor.store.listen(() => {
        debouncedSave(editor)
    }, { scope: 'document' })
    return () => unlisten()
  }, [editor, debouncedSave])

  if (isAuthLoading) {
    return <div style={{ position: 'fixed', inset: 0 }}><LoadingScreen /></div>;
  }
  if (!boardId) {
    return <MessageScreen title="No board selected" message="Please create or select a board from the admin or student dashboard." />;
  }
  if (loadError) {
    return <MessageScreen title="Access denied or board not found" message={loadError} />;
  }
  if (snapshot === null) {
    return <div style={{ position: 'fixed', inset: 0 }}><LoadingScreen /></div>
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
	  <BoardSwitcher currentBoardId={boardId} />
      <LiveUsers users={collaborators} />
      <Tldraw
        snapshot={snapshot}
        onMount={handleMount}
        autoFocus
      />
    </div>
  )
}
