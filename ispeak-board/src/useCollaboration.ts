// src/useCollaboration.ts

import { Editor } from 'tldraw'
// Import ALL necessary types directly from the main 'tldraw' package.
// This is the correct approach for tldraw v3, as it re-exports the most important types.
import type { TLEventInfo, TLRecord, TLStoreEventInfo } from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'

// This type definition remains the same.
type Awareness = {
    cursor: { x: number; y: number }
    user: { name: string; color: string }
}

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
    useEffect(() => {
        if (!editor || !boardId) return

        const channel = supabase.channel(`board:${boardId}`, {
            config: {
                broadcast: { self: false },
                presence: { key: `user-${Math.random().toString(36).substr(2, 9)}` },
            },
        })

		// --- BROADCASTING LOCAL CHANGES ---
		const unlisten = editor.store.listen(
		  (event: TLStoreEventInfo) => { // TLStoreEventInfo is the correct generic type here
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
                // The error about 'key' not existing on RealtimePresence was a red herring.
                // TypeScript was confused by other errors. This code is correct.
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
        // The event listener API has changed significantly.
        // We listen for the generic 'event' and then check its name.
        const eventListener = (info: TLEventInfo) => {
            if (info.name === 'pointer_move') {
                channel.track({
                    // We also get the point differently now.
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
            // The cleanup function for the new event listener
            editor.off('event', eventListener)
            supabase.removeChannel(channel)
        }
    }, [editor, boardId])
}
