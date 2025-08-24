// src/useCollaboration.ts

// Import helpers from tldraw's state management library
import { atom, react } from '@tldraw/state'
import {
	Editor,
	createPresenceStateDerivation,
	// Import the specific types we need
	type TLInstancePresence,
	type TLRecord,
	type TLStoreEventInfo,
	type TLPresenceUserInfo,
} from 'tldraw'
import { useEffect } from 'react'
import { supabase } from './supabaseClient'

// The data we'll send over the wire. We omit the fields that are static.
type Awareness = Omit<TLInstancePresence, 'id' | 'typeName'>

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
	useEffect(() => {
		if (!editor || !boardId) return

		// Use the editor's unique instance ID as the key for this user's session.
		const presenceKey = editor.instanceId

		// Create a reactive "atom" for our user info. This is required by the helper.
		const userInfo = atom<TLPresenceUserInfo>('user info', {
			id: editor.user.id,
			name: 'Anonymous User',
			color: '#ff69b4',
		})

		// The official tldraw helper function to derive the complete, valid presence state.
		const presenceDerivation = createPresenceStateDerivation(userInfo)(editor.store)

		const channel = supabase.channel(`board:${boardId}`, {
			config: {
				broadcast: { self: false },
				presence: { key: presenceKey },
			},
		})

		// --- BROADCASTING LOCAL CHANGES (Shapes, etc.) ---
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

		// --- RECEIVING AND APPLYING REMOTE CHANGES ---
		channel.on('broadcast', { event: 'tldraw-changes' }, ({ payload }) => {
			editor.store.mergeRemoteChanges(() => {
				editor.store.applyDiff(payload)
			})
		})

		// --- HANDLING REMOTE USER PRESENCE ---
		channel.on('presence', { event: 'sync' }, () => {
			const presenceState = channel.presenceState<Awareness>()
			const presences: TLInstancePresence[] = []

			for (const userId in presenceState) {
				if (userId === presenceKey) continue
				const presence = presenceState[userId][0]
				if (presence) {
					// Reconstruct the full record before putting it in the store
					presences.push({
						id: editor.store.id.createPresenceId(userId),
						typeName: 'instance_presence',
						...presence,
					})
				}
			}
			editor.store.put(presences)
		})

		// --- TRACKING AND BROADCASTING OUR OWN PRESENCE ---
		// `react` is a tldraw state helper that runs a function whenever the derived presence state changes.
		const stopTracking = react('track presence', () => {
			const presence = presenceDerivation.get()
			if (presence) {
				// We only send the dynamic parts of our presence state.
				const { id, typeName, ...payload } = presence
				channel.track(payload)
			}
		})

		// --- SUBSCRIBE AND CLEANUP ---
		channel.subscribe()

		return () => {
			unlistenChanges()
			stopTracking() // Clean up the reaction
			supabase.removeChannel(channel)
		}
	}, [editor, boardId])
}
