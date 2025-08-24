// src/useCollaboration.ts

import { Editor } from 'tldraw'
import type { TLChange, TLRecord } from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'
import { RealtimeChannel } from '@supabase/supabase-js'

// Define the shape of the data we send for presence
type Awareness = {
    cursor: { x: number; y: number }
    user: { name: string; color: string }
}

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
    useEffect(() => {
        if (!editor || !boardId) return

        const channel = supabase.channel(`board:${boardId}`, {
            config: {
                // This prevents the "echo" problem where you receive your own messages
                broadcast: { self: false },
                presence: { key: `user-${Math.random().toString(36).substr(2, 9)}` },
            },
        })

		// --- BROADCASTING LOCAL CHANGES ---
		const unlisten = editor.store.listen(
		  (changes: TLChange) => {
			if (changes.source !== 'user') return

			channel.send({
			  type: 'broadcast',
			  event: 'tldraw-changes',
			  // send only the "changes.changes" diff
			  payload: changes.changes,
			})
		  },
		  { source: 'user', scope: 'document' }
		)

		// --- RECEIVING AND APPLYING REMOTE CHANGES ---
		channel.on('broadcast', { event: 'tldraw-changes' }, ({ payload }) => {
		  console.log('Received remote changes:', payload)

		  editor.store.mergeRemoteChanges(() => {
			editor.store.applyDiff(payload) // payload is already the diff now
		  })
		})
        
        // --- HANDLING PRESENCE (CURSORS) --- 
        channel.on('presence', { event: 'sync' }, () => {
            const presenceState = channel.presenceState<Awareness>()
            const presences: TLRecord[] = []
            
            for (const key in presenceState) {
                // Filter out our own presence key to avoid rendering our own cursor
                if (key === channel.presence.key) continue

                const presence = presenceState[key][0]
                if (presence?.cursor && presence?.user) {
                    presences.push({
                        id: `instance_presence:${key}`,
                        typeName: 'instance_presence',
                        userId: key,
                        userName: presence.user.name,
                        cursor: presence.cursor,
                        color: presence.user.color,
                        lastActivityTimestamp: Date.now(),
                    } as TLRecord)
                }
            }
            editor.store.put(presences)
        })

        // --- TRACKING OUR OWN CURSOR ---
        const pointerMoveUnsub = editor.on('pointermove', (event) => {
            channel.track({
                cursor: event.point,
                user: { name: 'Anonymous User', color: '#ff69b4' },
            })
        })

        // --- SUBSCRIBE TO THE CHANNEL ---
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Subscribed to channel: board:${boardId}`)
            }
        })

        // --- CLEANUP ---
        return () => {
            unlisten()
            pointerMoveUnsub()
            supabase.removeChannel(channel)
        }
    }, [editor, boardId])
}
