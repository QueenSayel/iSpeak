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
        
        const presenceKey = `user-${Math.random().toString(36).substr(2, 9)}`

        const channel = supabase.channel(`board:${boardId}`, {
            config: {
                broadcast: { self: false },
                presence: { key: presenceKey },
            },
        })

		// --- BROADCASTING LOCAL CHANGES ---
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

		// --- RECEIVING AND APPLYING REMOTE CHANGES ---
		channel.on('broadcast', { event: 'tldraw-changes' }, ({ payload }) => {
		  console.log('Received remote changes:', payload)

		  editor.store.mergeRemoteChanges(() => {
			editor.store.applyDiff(payload)
		  })
		})
        
        // --- HANDLING PRESENCE (CURSORS) --- 
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
                        cursor: presence.cursor,
                        color: presence.user.color,
                        lastActivityTimestamp: Date.now(),
                        // --- FIX: Add the missing property required by the tldraw schema ---
                        followingUserId: null,
                    } as TLRecord)
                }
            }
            editor.store.put(presences)
        })

        // --- TRACKING OUR OWN CURSOR ---
        const eventListener = (info: TLEventInfo) => {
            if (info.name === 'pointer_move') {
                channel.track({
                    cursor: editor.inputs.currentScreenPoint,
                    user: { name: 'Anonymous User', color: '#ff69b4' },
                })
            }
        }
        
        editor.on('event', eventListener)

        // --- SUBSCRIBE TO THE CHANNEL ---
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Subscribed to channel: board:${boardId}`)
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
