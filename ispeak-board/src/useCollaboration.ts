// src/useCollaboration.ts

import { Editor } from 'tldraw'
import type { TLEventInfo, TLRecord, TLStoreEventInfo } from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'

type Awareness = {
  cursor: { x: number; y: number }
  user: { name: string; color: string }
}

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
  useEffect(() => {
    if (!editor || !boardId) return

    // unique presence key for this browser tab
    const presenceKey = `user-${Math.random().toString(36).slice(2, 11)}`

    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: presenceKey },
      },
    })

    // --- 1) SEND LOCAL DIFFS -------------------------------------------------
    const unlisten = editor.store.listen(
      (event: TLStoreEventInfo) => {
        if (event.source !== 'user') return
        channel.send({
          type: 'broadcast',
          event: 'tldraw-changes',
          payload: event.changes, // send the diff only
        })
      },
      { source: 'user', scope: 'document' }
    )

    // --- 2) RECEIVE REMOTE DIFFS --------------------------------------------
    channel.on('broadcast', { event: 'tldraw-changes' }, ({ payload }) => {
      editor.store.mergeRemoteChanges(() => {
        editor.store.applyDiff(payload)
      })
    })

    // Helper: rebuild presence list from current Supabase presence state
    const rebuildPresences = () => {
      const presenceState = channel.presenceState<Awareness>()
      const presences: TLRecord[] = []

      const currentPageId = editor.getCurrentPageId()

      for (const key in presenceState) {
        if (key === presenceKey) continue // don't render our own cursor

        const p = presenceState[key]?.[0]
        if (!p?.cursor || !p?.user) continue

        presences.push({
          id: `instance_presence:${key}`,
          typeName: 'instance_presence',
          userId: key,
          userName: p.user.name,
          color: p.user.color,

          // REQUIRED FIELDS IN TLInstancePresence:
          currentPageId,                // must be set
          camera: null,                 // we are not syncing camera; null is valid
          cursor: {
            x: p.cursor.x,
            y: p.cursor.y,
            type: 'default',
            rotation: 0,
          },
          screenBounds: null,           // null is valid
          scribbles: [],                // empty array is valid
          selectedShapeIds: [],         // empty array is valid
          meta: {},                     // empty object is valid

          // Nice-to-have / optional fields:
          chatMessage: null as any,
          followingUserId: null,
          lastActivityTimestamp: Date.now(),
        } as TLRecord)
      }

      // Put all peer presences at once (replace any previous ones)
      editor.store.put(presences)
    }

    // --- 3) RECEIVE PRESENCE EVENTS (CURSORS) --------------------------------
    // Rebuild on full sync, join, and leave to stay consistent.
    channel.on('presence', { event: 'sync' }, rebuildPresences)
    channel.on('presence', { event: 'join' }, rebuildPresences)
    channel.on('presence', { event: 'leave' }, rebuildPresences)

    // --- 4) TRACK OUR OWN CURSOR ---------------------------------------------
    // Track on pointer move; use PAGE coordinates to match tldraw expectations.
    const eventListener = (info: TLEventInfo) => {
      if (info.name === 'pointer_move') {
        channel.track({
          cursor: editor.inputs.currentPagePoint, // page-space point
          user: { name: 'Anonymous User', color: '#ff69b4' },
        })
      }
    }
    editor.on('event', eventListener)

    // Optional: send an initial presence so others can see you before you move.
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // push an initial presence (no cursor until first move)
        channel.track({
          cursor: null,
          user: { name: 'Anonymous User', color: '#ff69b4' },
        })
      }
    })

    // --- CLEANUP --------------------------------------------------------------
    return () => {
      unlisten()
      editor.off('event', eventListener)
      supabase.removeChannel(channel)
    }
  }, [editor, boardId])
}
