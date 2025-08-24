// src/useCollaboration.ts

import { Editor, createPresenceStateDerivation } from 'tldraw'
import type { TLRecord, TLStoreEventInfo } from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'
import { RealtimeChannel } from '@supabase/supabase-js'

// This is the data that will be sent over the wire. It's a subset of the full presence record.
// We extract only the state that changes, not the static properties like id or typeName.
type Awareness = Omit<TLRecord['instance_presence'], 'id' | 'typeName' | 'userId' | 'userName'>

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
    useEffect(() => {
        if (!editor || !boardId) return

        const presenceKey = `user-${Math.random().toString(36).substr(2, 9)}`
        const user = { name: 'Anonymous User', color: '#ff69b4' }

        const channel = supabase.channel(`board:${boardId}`, {
            config: {
                broadcast: { self: false },
                presence: { key: presenceKey },
            },
        })

		// --- BROADCASTING LOCAL CHANGES (Unchanged) ---
		const unlistenChanges = editor.store.listen(
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

		// --- RECEIVING AND APPLYING REMOTE CHANGES (Unchanged) ---
		channel.on('broadcast', { event: 'tldraw-changes' }, ({ payload }) => {
		  console.log('Received remote changes:', payload)
		  editor.store.mergeRemoteChanges(() => {
			editor.store.applyDiff(payload)
		  })
		})
        
        // --- HANDLING PRESENCE --- 
        channel.on('presence', { event: 'sync' }, () => {
            const presenceState = channel.presenceState<Awareness>()
            const presences: TLRecord[] = []
            
            for (const key in presenceState) {
                if (key === presenceKey) continue

                const presence = presenceState[key][0]
                if (presence) {
                    // Reconstruct the full TLRecord from the broadcasted state
                    presences.push({
                        id: `instance_presence:${key}`,
                        typeName: 'instance_presence',
                        userId: key,
                        userName: user.name, // In a real app, you'd send this too
                        ...presence,
                    })
                }
            }
            // Put all received presence records into the store
            editor.store.put(presences)
        })

        // --- THE OFFICIAL TLDRAW HELPER FOR PRESENCE ---
        // This creates a reactive "atom" that automatically tracks all the
        // properties needed for a valid presence record.
        const presenceDerivation = createPresenceStateDerivation(user)(() => editor.store)

        // --- TRACKING OUR OWN PRESENCE ---
        // When our local presence changes, broadcast it to others.
        const unlistenPresence = presenceDerivation.listen(({ value }) => {
            if (value) {
                // Remove properties that are specific to the local record
                const { id, typeName, userId, ...payload } = value
                channel.track(payload)
            }
        })

        // --- SUBSCRIBE AND CLEANUP ---
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Subscribed to channel: board:${boardId}`)
            }
        })

        return () => {
            unlistenChanges()
            unlistenPresence()
            supabase.removeChannel(channel)
        }
    }, [editor, boardId])
}
