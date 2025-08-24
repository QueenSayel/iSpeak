// src/useCollaboration.ts

import { Editor } from 'tldraw'
import type { TLEventInfo, TLRecord, TLStoreEventInfo } from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'

type Awareness = {
  cursor: { x: number; y: number } | null
  user: { name: string; color: string }
}

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
  useEffect(() => {
    if (!editor || !boardId) return

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
          payload: event.changes, // send only the diff
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

    // Helper to rebuild all peer presences
    const rebuildPresences = () => {
      const presenceState = channel.presenceState<Awareness>()
      const presences: TLRecord[] = []
      const currentPageId = editor.getCurrentPageId()
      const camera = editor.getCamera() // must be an object

      for (const key in presenceState) {
        if (key === presenceKey) continue

        const p = presenceState[key]?.[0]
        if (!p?.user) continue

        const hasCursor = !!p.cursor

        presences.push({
          id: `instance_presence:${key}`,
          typeName: 'instance_presence',
          userId: key,
          userName: p.user.name,
          color: p.user.color,

          // required presence fields in 3.15.x:
          currentPageId,
          camera,                // must be an object (not undefined)
          screenBounds: null,    // ok to be null
          brush: null,           // REQUIRED: include this, null is fine
          scribbles: [],         // empty array is fine
          selectedShapeIds: [],  // empty array is fine
          meta: {},              // empty object is fine

          cursor: hasCursor
            ? {
                x: p.cursor!.x,
                y: p.cursor!.y,
                type: 'default',
                rotation: 0,
              }
            : null,

          followingUserId: null,
          lastActivityTimestamp: Date.now(),
        } as TLRecord)
      }

      editor.store.put(presences)
    }

    // --- 3) RECEIVE PRESENCE EVENTS (CURSORS) --------------------------------
    channel.on('presence', { event: 'sync' }, rebuildPresences)
    channel.on('presence', { event: 'join' }, rebuildPresences)
    channel.on('presence', { event: 'leave' }, rebuildPresences)

    // --- 4) TRACK OUR OWN CURSOR ---------------------------------------------
    const eventListener = (info: TLEventInfo) => {
      if (info.name === 'pointer_move') {
        channel.track({
          cursor: editor.inputs.currentPagePoint, // page-space point
          user: { name: 'Anonymous User', color: '#ff69b4' },
        })
      }
    }
    editor.on('event', eventListener)

    // send an initial presence (no cursor until first move)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({
          cursor: null,
          user: { name: 'Anonymous User', color: '#ff69b4' },
        })
      }
    })

    return () => {
      unlisten()
      editor.off('event', eventListener)
      supabase.removeChannel(channel)
    }
  }, [editor, boardId])
}
