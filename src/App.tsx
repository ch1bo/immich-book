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
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/ch1bo/immich-book"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                title="View on GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
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
