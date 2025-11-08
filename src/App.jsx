import { useState } from 'react'
import ConnectionForm from './components/ConnectionForm'
import AlbumSelector from './components/AlbumSelector'
import PhotoGrid from './components/PhotoGrid'

function App() {
  const [immichConfig, setImmichConfig] = useState(null)
  const [selectedAlbum, setSelectedAlbum] = useState(null)

  const handleConnect = (config) => {
    setImmichConfig(config)
  }

  const handleDisconnect = () => {
    setImmichConfig(null)
    setSelectedAlbum(null)
  }

  const handleAlbumSelect = (album) => {
    setSelectedAlbum(album)
  }

  const handleBackToAlbums = () => {
    setSelectedAlbum(null)
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm no-print">
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
