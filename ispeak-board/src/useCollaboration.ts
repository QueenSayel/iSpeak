// src/useCollaboration.ts

import { Editor } from 'tldraw'
import type { TLChange, TLRecord, TLEventInfo } from 'tldraw' // CORRECTED: Use 'import type'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
// 'RealtimeChannel' was unused, so it has been removed.

// Define the shape of the data we send for presence
type Awareness = {
    cursor: { x: number; y: number }
    user: { name: string; color: string }
}

// A simple utility to generate a consistent color from a user ID
function getUserColor(id: string) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 80%, 70%)`;
}

export function useCollaboration(editor: Editor | undefined, boardId: string | null) {
    const [user, setUser] = useState<{ id: string, email: string } | null>(null);

    // Fetch the current user's data once when the hook loads
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser({ id: user.id, email: user.email || 'Anonymous' });
            }
        };
        fetchUser();
    }, []);

    useEffect(() => {
        if (!editor || !boardId || !user) return;

        const channel = supabase.channel(`board:${boardId}`, {
            config: {
                broadcast: { self: false },
                presence: { key: user.id }, // Use the stable user ID as the key
            },
        })

        // --- BROADCASTING LOCAL CHANGES (This part is correct) ---
        const unlisten = editor.store.listen(
            (change: TLChange) => {
                if (change.source !== 'user') return;
                const diff = {
                    added: change.added,
                    updated: change.updated,
                    removed: change.removed,
                };
                if (Object.keys(diff.added).length || Object.keys(diff.updated).length || Object.keys(diff.removed).length) {
                    channel.send({
                        type: 'broadcast',
                        event: 'tldraw-changes',
                        payload: diff,
                    });
                }
            },
            { source: 'user', scope: 'document' }
        )

        // --- RECEIVING AND APPLYING REMOTE CHANGES (This part is correct) ---
        channel.on('broadcast', { event: 'tldraw-changes' }, ({ payload }) => {
            console.log('Received remote changes:', payload);
            if (payload) {
                editor.store.mergeRemoteChanges(() => {
                    editor.store.applyDiff(payload);
                });
            }
        });
        
        // --- HANDLING PRESENCE (CURSORS) ---
        channel.on('presence', { event: 'sync' }, () => {
            const presenceState = channel.presenceState<Awareness>()
            const presences: TLRecord[] = []
            
            for (const key in presenceState) {
                if (key === user.id) continue;
                const presence = presenceState[key][0];
                if (presence?.cursor && presence?.user) {
                    presences.push({
                        id: `instance_presence:${key}`, typeName: 'instance_presence',
                        userId: key, userName: presence.user.name,
                        cursor: presence.cursor, color: presence.user.color,
                        lastActivityTimestamp: Date.now(),
                    } as TLRecord);
                }
            }
            editor.store.put(presences);
        });

        // --- TRACKING OUR OWN CURSOR (CORRECTED) ---
        // We listen to the generic 'event' and filter for pointer moves.
        const eventUnsub = editor.on('event', (info: TLEventInfo) => {
            if (info.name === 'pointer_move') {
                channel.track({
                    cursor: info.point,
                    user: { name: user.email, color: getUserColor(user.id) },
                });
            }
        });

        // --- SUBSCRIBE TO THE CHANNEL ---
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Subscribed to channel: board:${boardId}`);
            }
        });

        // --- CLEANUP ---
        return () => {
            unlisten();
            eventUnsub(); // Unsubscribe from the generic event listener
            supabase.removeChannel(channel);
        }
    }, [editor, boardId, user]);
}
