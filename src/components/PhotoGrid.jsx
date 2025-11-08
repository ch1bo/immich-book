import { useState, useEffect } from 'react'
import { getAlbumInfo } from '@immich/sdk'

function PhotoGrid({ immichConfig, album, onBack }) {
  const [assets, setAssets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [columns, setColumns] = useState(3)

  useEffect(() => {
    loadAlbumAssets()
  }, [album.id])

  const loadAlbumAssets = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const albumData = await getAlbumInfo({ id: album.id })
      setAssets(albumData.assets || [])
    } catch (err) {
      setError(err.message || 'Failed to load album assets')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-4 text-gray-600">Loading photos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto">
        <button
          onClick={onBack}
          className="mb-4 text-blue-600 hover:text-blue-800"
        >
          ← Back to albums
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={loadAlbumAssets}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Controls - Hidden when printing */}
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Back to albums
          </button>
          <h2 className="text-2xl font-semibold">{album.albumName}</h2>
          <p className="text-gray-600 mt-1">{assets.length} photos</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="columns" className="text-sm font-medium text-gray-700">
              Columns:
            </label>
            <select
              id="columns"
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* Photo Grid */}
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {assets.map((asset) => (
          <div key={asset.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="aspect-square bg-gray-100 relative">
              <img
                src={`${immichConfig.baseUrl}/assets/${asset.id}/thumbnail?size=preview&x-api-key=${immichConfig.apiKey}`}
                alt={asset.originalFileName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {asset.exifInfo?.description && (
              <div className="p-4">
                <p className="text-sm text-gray-700">{asset.exifInfo.description}</p>
              </div>
            )}
            {asset.fileCreatedAt && (
              <div className="px-4 pb-4 text-xs text-gray-500">
                {new Date(asset.fileCreatedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default PhotoGrid
