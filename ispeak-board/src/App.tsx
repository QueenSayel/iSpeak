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
        padding: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            color: '#2b2d42',
            margin: 0,
            fontSize: '1.5rem',
            marginBottom: '-5rem',
            transform: 'translateX(-2rem)',
            display: 'flex',
            gap: '0.1rem',
          }}
        >
          <span>Loading</span>
          <span className="dot">.</span>
          <span className="dot">.</span>
          <span className="dot">.</span>
        </h2>
        <img
          src="/board/loader.gif"
          alt="Loading animation"
          style={{
            width: 'min(80vw, 400px)',
            height: 'auto',
          }}
        />
      </div>

      <style>
        {`
          .dot {
            opacity: 0;
            animation: blink 1.5s infinite;
          }
          .dot:nth-child(2) { animation-delay: 0.3s; }
          .dot:nth-child(3) { animation-delay: 0.6s; }
          .dot:nth-child(4) { animation-delay: 0.9s; }

          @keyframes blink {
            0%, 20% { opacity: 0; }
            30%, 100% { opacity: 1; }
          }
        `}
      </style>
    </div>
  )
}

function BoardSwitcher({ currentBoardId }: { currentBoardId: string | null }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [boards, setBoards] = useState<{ id: string, name: string }[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching user role:', profileError);
      } else {
        setUserRole(profile.role);
      }
      
      const { data: boardsData, error: boardsError } = await supabase
        .from('boards')
        .select('id, name')
        .order('created_at', { ascending: false });

      if (boardsError) {
        console.error('Error fetching board list:', boardsError);
      } else {
        setBoards(boardsData || []);
      }
    };
    fetchData();
  }, []);

  const dashboardLink = userRole === 'admin' ? '/admin' : '/student';

  return (
    <div 
      className={`board-switcher ${isExpanded ? 'expanded' : ''}`}
      onMouseLeave={() => setIsExpanded(false)}
    >
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
        <a href={dashboardLink} className="dashboard-link">
          <i className="fa-solid fa-arrow-left"></i>
          Dashboard
        </a>
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
        window.location.href = '/login';
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
