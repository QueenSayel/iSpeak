// src/useCollaboration.ts

import { Editor } from 'tldraw'
import type { TLEventInfo, TLRecord, TLStoreEventInfo, TLShapeId, TLPageId } from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'

// Minimal presence info we send to Supabase
type Awareness = {
  user: { name: string; color: string }
  cursor: { x: number; y: number }
  camera: { x: number; y: number; z: number }
  screenBounds: { x: number; y: number; w: number; h: number }
  selectedShapeIds: TLShapeId[]
  currentPageId: TLPageId
}

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
  useEffect(() => {
    if (!editor || !boardId) return

    const presenceKey = `user-${Math.random().toString(36).substr(2, 9)}`

    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: presenceKey },
      },
    })

    // --- BROADCAST LOCAL CHANGES ---
    const unlisten = editor.store.listen(
      (event: TLStoreEventInfo) => {
        if (event.source !== 'user') return
        channel.send({
          type: 'broadcast',
          event: 'tldraw-changes',
          payload: event.changes,
        })
      },
      { source: 'user', scope: 'document' }
    )

    // --- APPLY REMOTE CHANGES ---
    channel.on('broadcast', { event: 'tldraw-changes' }, ({ payload }) => {
      editor.store.mergeRemoteChanges(() => {
        editor.store.applyDiff(payload)
      })
    })

    // --- HANDLE REMOTE PRESENCE ---
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState<Awareness>()
      const presences: TLRecord[] = []

      for (const key in presenceState) {
        if (key === presenceKey) continue
        const presence = presenceState[key][0]

        if (presence?.cursor && presence?.user) {
          presences.push({
            id: `instance_presence:${key}`,
            typeName: 'instance_presence',
            userId: key,
            userName: presence.user.name,
            lastActivityTimestamp: Date.now(),
            color: presence.user.color,
            camera: presence.camera || { x: 0, y: 0, z: 1 },
            screenBounds: presence.screenBounds || { x: 0, y: 0, w: 1, h: 1 },
            followingUserId: null,
            cursor: {
              x: presence.cursor.x,
              y: presence.cursor.y,
              type: 'default',
              rotation: 0,
            },
            selectedShapeIds: presence.selectedShapeIds || [],
            currentPageId: presence.currentPageId || '',
            chatMessage: '', // required for cursor to show
          } as TLRecord)
        }
      }

      editor.store.mergeRemoteChanges(() => {
        editor.store.put(presences)
      })
    })

    // --- TRACK OUR OWN PRESENCE ---
    const sendPresence = () => {
      channel.track({
        user: { name: 'Anonymous User', color: '#ff69b4' },
        cursor: editor.inputs.currentScreenPoint,
        camera: editor.getCamera(),
        screenBounds: editor.getViewportScreenBounds(),
        selectedShapeIds: editor.getSelectedShapeIds(),
        currentPageId: editor.getCurrentPageId(),
      })
    }

    // Track on every editor tick
    const eventListener = (info: TLEventInfo) => {
      if (info.name === 'tick') sendPresence()
    }

    editor.on('event', eventListener)

    // --- SUBSCRIBE TO CHANNEL ---
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to channel: board:${boardId}`)
        sendPresence() // ensure initial presence is broadcast immediately
      }
    })

    // --- CLEANUP ---
    return () => {
      unlisten()
      editor.off('event', eventListener)
      supabase.removeChannel(channel)
    }
  }, [editor, boardId])
}
