import { useState, useEffect } from 'react'
import { init, getAlbumInfo, type AlbumResponseDto } from '@immich/sdk'
import ConnectionForm, { type ImmichConfig } from './components/ConnectionForm'
import AlbumSelector from './components/AlbumSelector'
import PhotoGrid from './components/PhotoGrid'

function App() {
  const [immichConfig, setImmichConfig] = useState<ImmichConfig | null>(null)
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumResponseDto | null>(null)
  const [isLoadingAlbum, setIsLoadingAlbum] = useState(false)

  // Load config from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('immich-config')
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig)
        // Re-initialize the SDK with saved config
        init({ baseUrl: config.baseUrl, apiKey: config.apiKey })
        setImmichConfig(config)
      } catch (err) {
        console.error('Failed to load saved config:', err)
        localStorage.removeItem('immich-config')
      }
    }
  }, [])

  // Load last selected album when config is available
  useEffect(() => {
    if (!immichConfig) return

    const savedAlbumId = localStorage.getItem('last-album-id')
    if (savedAlbumId && !selectedAlbum) {
      setIsLoadingAlbum(true)
      getAlbumInfo({ id: savedAlbumId })
        .then((album) => {
          setSelectedAlbum(album)
        })
        .catch((err) => {
          console.error('Failed to load saved album:', err)
          localStorage.removeItem('last-album-id')
        })
        .finally(() => {
          setIsLoadingAlbum(false)
        })
    }
  }, [immichConfig])

  const handleConnect = (config: ImmichConfig) => {
    setImmichConfig(config)
  }

  const handleDisconnect = () => {
    setImmichConfig(null)
    setSelectedAlbum(null)
    localStorage.removeItem('immich-config')
    localStorage.removeItem('last-album-id')
  }

  const handleAlbumSelect = (album: AlbumResponseDto) => {
    setSelectedAlbum(album)
    // Save album ID to localStorage
    localStorage.setItem('last-album-id', album.id)
  }

  const handleBackToAlbums = () => {
    setSelectedAlbum(null)
    // Don't remove from localStorage - keep it for next time
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Immich Book</h1>
              <p className="text-sm text-gray-500">Create photo books from your Immich albums</p>
            </div>
            {immichConfig && (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!immichConfig ? (
          <ConnectionForm onConnect={handleConnect} />
        ) : isLoadingAlbum ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-gray-600">Loading last album...</p>
          </div>
        ) : !selectedAlbum ? (
          <AlbumSelector
            immichConfig={immichConfig}
            onSelectAlbum={handleAlbumSelect}
          />
        ) : (
          <PhotoGrid
            immichConfig={immichConfig}
            album={selectedAlbum}
            onBack={handleBackToAlbums}
          />
        )}
      </main>
    </div>
  )
}

export default App
