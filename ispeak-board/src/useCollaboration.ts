// src/useCollaboration.ts

import { Editor } from 'tldraw'
import type { TLEventInfo, TLRecord, TLStoreEventInfo, TLShapeId, TLPageId } from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'

// --- STEP 1: EXPAND THE AWARENESS PAYLOAD ---
// We need to broadcast more than just the cursor.
type Awareness = {
    user: { name: string; color: string }
    cursor: { x: number; y: number }
    camera: { x: number; y: number; z: number }
    screenBounds: { x: number, y: number, w: number, h: number }
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

		// --- BROADCASTING LOCAL CHANGES (Unchanged) ---
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

		// --- RECEIVING AND APPLYING REMOTE CHANGES (Unchanged) ---
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
                // Check for all the new data points before creating the record
                if (presence?.cursor && presence?.user && presence?.camera && presence.screenBounds) {
                    presences.push({
                        id: `instance_presence:${key}`,
                        typeName: 'instance_presence',
                        userId: key,
                        userName: presence.user.name,
                        lastActivityTimestamp: Date.now(),
                        color: presence.user.color,
                        
                        // --- STEP 3: RECONSTRUCT THE FULL RECORD ---
                        // Use all the broadcasted data to create a valid presence record.
                        camera: presence.camera,
                        screenBounds: presence.screenBounds,
                        followingUserId: null,
                        cursor: {
                            x: presence.cursor.x,
                            y: presence.cursor.y,
                            type: 'default',
                            rotation: 0,
                        },
                        selectedShapeIds: presence.selectedShapeIds,
                        currentPageId: presence.currentPageId,
                    } as TLRecord)
                }
            }
            editor.store.put(presences)
        })

        // --- TRACKING OUR OWN CURSOR, CAMERA, ETC. ---
        const eventListener = (info: TLEventInfo) => {
            // We can track on multiple events, but pointer_move is the most frequent.
            if (info.name === 'pointer_move' || info.name === 'zoom' || info.name === 'pan') {
                // --- STEP 2: BROADCAST THE FULL AWARENESS STATE ---
                channel.track({
                    user: { name: 'Anonymous User', color: '#ff69b4' },
                    cursor: editor.inputs.currentScreenPoint,
                    camera: editor.camera,
                    screenBounds: editor.viewportScreenBounds,
                    selectedShapeIds: editor.selectedShapeIds,
                    currentPageId: editor.currentPageId,
                })
            }
        }
        
        editor.on('event', eventListener)

        // --- SUBSCRIBE TO THE CHANNEL (Unchanged) ---
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Subscribed to channel: board:${boardId}`)
            }
        })

        // --- CLEANUP (Unchanged) ---
        return () => {
            unlisten()
            editor.off('event', eventListener)
            supabase.removeChannel(channel)
        }
    }, [editor, boardId])
}
