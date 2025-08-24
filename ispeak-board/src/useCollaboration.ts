// src/useCollaboration.ts

import { Editor } from 'tldraw'
import type { TLEventInfo, TLRecord, TLStoreEventInfo, TLShapeId, TLPageId } from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'

// The data we broadcast to other users
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
        
        // --- HANDLING PRESENCE (CURSORS, CAMERAS, etc.) (Unchanged from last version) --- 
        channel.on('presence', { event: 'sync' }, () => {
            const presenceState = channel.presenceState<Awareness>()
            const presences: TLRecord[] = []
            
            for (const key in presenceState) {
                if (key === presenceKey) continue

                const presence = presenceState[key][0]
                if (presence?.cursor && presence?.user && presence?.camera && presence.screenBounds) {
                    presences.push({
                        id: `instance_presence:${key}`,
                        typeName: 'instance_presence',
                        userId: key,
                        userName: presence.user.name,
                        lastActivityTimestamp: Date.now(),
                        color: presence.user.color,
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

        // --- TRACKING OUR OWN PRESENCE STATE ---
        const eventListener = (info: TLEventInfo) => {
            // FIX: Use the 'tick' event to capture all user interactions efficiently.
            if (info.name === 'tick') {
                // FIX: Use getter methods to access editor state properties.
                channel.track({
                    user: { name: 'Anonymous User', color: '#ff69b4' },
                    cursor: editor.inputs.currentScreenPoint,
                    camera: editor.getCamera(),
                    screenBounds: editor.getViewportScreenBounds(),
                    selectedShapeIds: editor.getSelectedShapeIds(),
                    currentPageId: editor.getCurrentPageId(),
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
