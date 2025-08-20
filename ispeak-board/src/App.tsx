// src/App.tsx
import {
  Tldraw,
  getSnapshot,
  type Editor,
  type TLStoreSnapshot,
  type TLAsset,
  type AssetUtils, // 1. Import the AssetUtils type (good practice)
} from 'tldraw'
import 'tldraw/tldraw.css'
import { useCallback, useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { supabase } from './supabaseClient'

const BOARD_ID = 'my-first-board'

// 2. Define our custom asset utility outside the component.
// This object implements the `create` method of the AssetUtils interface.
const myAssetUtils: AssetUtils = {
  async create(file: File): Promise<TLAsset> {
    // The logic inside is the same as our old handleAssetCreate function.

    // Create a unique file name for the asset.
    const fileName = `${crypto.randomUUID()}-${file.name}`

    // Upload the file to the 'board-assets' bucket in Supabase Storage.
    const { data, error } = await supabase.storage
      .from('board-assets')
      .upload(fileName, file)

    if (error) {
      console.error('Failed to upload asset:', error)
      throw new Error('Failed to upload asset')
    }

    // Get the public URL of the uploaded file.
    const {
      data: { publicUrl },
    } = supabase.storage.from('board-assets').getPublicUrl(data.path)

    // Get the image's dimensions.
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.width, h: img.height })
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })

    // Return a TLAsset object that tldraw will use.
    return {
      id: crypto.randomUUID() as TLAsset['id'],
      typeName: 'asset',
      type: 'image',
      props: {
        name: file.name,
        src: publicUrl, // The URL from Supabase Storage!
        w: size.w,
        h: size.h,
        mimeType: file.type,
        isAnimated: false,
      },
      meta: {},
    }
  },
}

// LoadingScreen component remains the same
function LoadingScreen() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
      }}
    >
      <h2>Loading Board...</h2>
    </div>
  )
}

export default function App() {
  const [editor, setEditor] = useState<Editor>()
  const [snapshot, setSnapshot] = useState<TLStoreSnapshot | null>(null)

  useEffect(() => {
    supabase
      .from('boards')
      .select('content')
      .eq('id', BOARD_ID)
      .then(({ data }) => {
        if (data?.[0]?.content) {
          setSnapshot(data[0].content)
        } else {
          setSnapshot({} as TLStoreSnapshot)
        }
      })
      .catch((error) => {
        console.error(error)
        setSnapshot({} as TLStoreSnapshot)
      })
  }, [])

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor)
  }, [])

  // 3. The old onAssetCreate useCallback handler is now REMOVED.

  const debouncedSave = useDebouncedCallback((editorToSave: Editor) => {
    const startTime = new Date()
    console.log(`--- EXECUTING SAVE LOGIC NOW --- at ${startTime.toLocaleTimeString()}`)
    const currentSnapshot = getSnapshot(editorToSave.store)
    const snapshotString = JSON.stringify(currentSnapshot)
    const sizeInBytes = new TextEncoder().encode(snapshotString).length
    const sizeInKB = (sizeInBytes / 1024).toFixed(2)
    const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2)
    console.log(`- Snapshot size: ${sizeInKB} KB (${sizeInMB} MB)`)

    supabase
      .from('boards')
      .upsert({ id: BOARD_ID, content: currentSnapshot })
      .then((response) => {
        if (response.error) {
          console.error('!!! Supabase Error saving board:', response.error)
        } else {
          const endTime = new Date()
          const duration = endTime.getTime() - startTime.getTime()
          console.log(
            `✅ Board saved successfully! at ${endTime.toLocaleTimeString()} (took ${duration}ms)`
          )
        }
      })
  }, 500)

  useEffect(() => {
    if (!editor) return
    const unlisten = editor.store.listen(() => {
      debouncedSave(editor)
    }, { scope: 'document' })
    return () => unlisten()
  }, [editor, debouncedSave])

  if (snapshot === null) {
    return (
      <div style={{ position: 'fixed', inset: 0 }}>
        <LoadingScreen />
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        snapshot={snapshot}
        onMount={handleMount}
        // 4. Pass the new assetUtils object to the Tldraw component.
        // REMOVE the old onAssetCreate prop.
        assetUtils={myAssetUtils}
        autoFocus
      />
    </div>
  )
}
