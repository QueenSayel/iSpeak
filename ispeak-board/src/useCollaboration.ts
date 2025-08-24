// src/useCollaboration.ts

import { Editor } from 'tldraw'
import type { TLRecord, TLStoreEventInfo, TLShapeId, TLPageId } from 'tldraw'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function getUserColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = hash % 360
  return `hsl(${h}, 80%, 70%)`
}

type Awareness = {
  id: string
  name: string
  color: string
  cursor: { x: number; y: number; type: string; rotation: number } | null
  camera: { x: number; y: number; z: number }
  screenBounds: { x: number; y: number; w: number; h: number }
  selectedShapeIds: TLShapeId[]
  currentPageId: TLPageId
}

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        console.log('%c[DEBUG] User identified:', 'color: green;', user.email)
        setUser({ id: user.id, email: user.email || 'Anonymous' })
      } else {
        console.error('[DEBUG] No user found!')
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (!editor || !boardId || !user) return

    const channel = supabase.channel(`board:${boardId}`, {
      config: { broadcast: { self: false }, presence: { key: user.id } },
    })

    const unlisten = editor.store.listen(
      (event: TLStoreEventInfo) => {
        if (event.source !== 'user') return
        channel.send({ type: 'broadcast', event: 'tldraw-changes', payload: event.changes })
      },
      { source: 'user', scope: 'document' }
    )

    channel.on('broadcast', { event: 'tldraw-changes' }, ({ payload }) => {
      if (payload) editor.store.mergeRemoteChanges(() => editor.store.applyDiff(payload))
    })

    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState<Awareness>()
      const presencesToPut: TLRecord[] = []
      const presencesToRemove: TLRecord['id'][] = []

      const presentIdsInStore = editor.store
        .query.records('instance_presence')
        .get()
        .map(p => p.userId as TLShapeId) // ✅ cast to branded type

      const incomingIds = new Set(Object.keys(presenceState))

      // Remove departed users
      for (const id of presentIdsInStore) {
        if (!incomingIds.has(id)) {
          presencesToRemove.push(`instance_presence:${id}` as TLRecord['id']) // ✅ cast to branded type
        }
      }
      if (presencesToRemove.length) editor.store.remove(presencesToRemove)

      // Process remote users
      for (const key in presenceState) {
        if (key === user.id) continue
        const presence = presenceState[key][0]
        if (!presence) continue

        const cursor = presence.cursor
          ? { x: presence.cursor.x, y: presence.cursor.y, type: presence.cursor.type || 'default', rotation: 0 }
          : null
        const camera = presence.camera || { x: 0, y: 0, z: 1 }

        presencesToPut.push({
          id: `instance_presence:${presence.id}` as TLRecord['id'],
          typeName: 'instance_presence',
          userId: presence.id,
          userName: presence.name,
          lastActivityTimestamp: Date.now(),
          color: presence.color,
          cursor,
          camera,
          screenBounds: presence.screenBounds,
          followingUserId: null,
          selectedShapeIds: presence.selectedShapeIds,
          currentPageId: presence.currentPageId,
          brush: null,
          scribbles: [],
          chatMessage: '',
          meta: {},
        })
      }

      if (presencesToPut.length) editor.store.put(presencesToPut)
    })

    // --- TRACK OUR OWN PRESENCE (throttled ~30Hz for performance) ---
    let lastSent = 0
    const sendPresence = () => {
      const now = Date.now()
      if (now - lastSent < 33) return
      lastSent = now

      const pt = editor.inputs.currentScreenPoint || { x: 0, y: 0 }
      const cursor = { x: pt.x, y: pt.y, type: 'default', rotation: 0 }
      const cam = editor.getCamera()
      const camera = cam ? { x: cam.x, y: cam.y, z: cam.z } : { x: 0, y: 0, z: 1 }

      channel.track({
        id: user.id,
        name: user.email,
        color: getUserColor(user.id),
        cursor,
        camera,
        screenBounds: editor.getViewportScreenBounds(),
        selectedShapeIds: editor.getSelectedShapeIds(),
        currentPageId: editor.getCurrentPageId(),
      })
    }

    const interval = setInterval(sendPresence, 33)

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to channel: board:${boardId}`)
        sendPresence()
      }
    })

    return () => {
      unlisten()
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [editor, boardId, user])
}
