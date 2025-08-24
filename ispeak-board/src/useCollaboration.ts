// src/useCollaboration.ts

import { Editor, TLEventInfo } from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { TLRecord } from 'tldraw'

// Data we broadcast via Supabase Presence
type Awareness = {
  cursor?: { x: number; y: number }
  user?: { name: string; color: string }
}

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
  useEffect(() => {
    if (!editor || !boardId) return

    const clientId = `user-${Math.random().toString(36).slice(2, 11)}`

    const channel: RealtimeChannel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: clientId },
      },
    })

    // --- 1) Broadcast local document changes ---
    const stopListening: () => void = editor.store.listen(
      (entry: any) => {
        if (entry?.source !== 'user') return
        channel.send({
          type: 'broadcast',
          event: 'tldraw-changes',
          payload: entry.changes,
        })
      },
      { source: 'user', scope: 'document' }
    )

    // --- 2) Apply remote changes ---
    channel.on('broadcast', { event: 'tldraw-changes' }, ({ payload }) => {
      editor.store.mergeRemoteChanges(() => {
        editor.store.applyDiff(payload)
      })
    })

    // --- 3) Presence: render remote cursors ---
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<Awareness>()
      const presences: TLRecord[] = []

      for (const key in state) {
        if (key === clientId) continue
        const p = state[key][0]
        if (p?.cursor) {
          presences.push({
            id: `instance_presence:${key}`,
            typeName: 'instance_presence',
            userId: key,
            userName: p.user?.name ?? 'Guest',
            color: p.user?.color ?? '#4f46e5',
            cursor: p.cursor,
            currentPageId: editor.getCurrentPageId(),
            lastActivityTimestamp: Date.now(),
          } as TLRecord)
        }
      }

      if (presences.length) editor.store.put(presences)
    })

    // --- 4) Broadcast our cursor ---
    const offPointer = editor.on('pointer', (e: TLEventInfo & { point?: { x: number; y: number } }) => {
      if (!e?.point) return
      channel.track({
        cursor: e.point,
        user: { name: 'Anonymous User', color: '#ff69b4' },
      } as Awareness)
    })

    // --- 5) Subscribe / cleanup ---
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to channel: board:${boardId}`)
      }
    })

    return () => {
      stopListening()
      offPointer()
      supabase.removeChannel(channel)
    }
  }, [editor, boardId])
}
