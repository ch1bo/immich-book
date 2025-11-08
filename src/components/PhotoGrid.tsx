import { useState, useEffect, useMemo, useRef } from 'react'
import { getAlbumInfo, type AlbumResponseDto, type AssetResponseDto } from '@immich/sdk'
import { JustifiedLayout } from '@immich/justified-layout-wasm'
import type { ImmichConfig } from './ConnectionForm'

interface PhotoGridProps {
  immichConfig: ImmichConfig
  album: AlbumResponseDto
  onBack: () => void
}

function PhotoGrid({ immichConfig, album, onBack }: PhotoGridProps) {
  const [assets, setAssets] = useState<AssetResponseDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [containerWidth, setContainerWidth] = useState(1200)
  const containerRef = useRef<HTMLDivElement>(null)
  const [rowHeight, setRowHeight] = useState(250)

  useEffect(() => {
    loadAlbumAssets()
  }, [album.id])

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const loadAlbumAssets = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const albumData = await getAlbumInfo({ id: album.id })
      setAssets(albumData.assets || [])
    } catch (err) {
      setError((err as Error).message || 'Failed to load album assets')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Calculate justified layout
  const layout = useMemo(() => {
    if (assets.length === 0) return null

    // Extract aspect ratios from assets
    const aspectRatios = new Float32Array(
      assets.map((asset) => {
        const width = asset.exifInfo?.exifImageWidth || 1
        const height = asset.exifInfo?.exifImageHeight || 1
        return width / height
      })
    )

    return new JustifiedLayout(aspectRatios, {
      rowHeight,
      rowWidth: containerWidth,
      spacing: 4,
      heightTolerance: 0.1,
    })
  }, [assets, containerWidth, rowHeight])

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
            <label htmlFor="rowHeight" className="text-sm font-medium text-gray-700">
              Row Height:
            </label>
            <input
              type="range"
              id="rowHeight"
              min="150"
              max="400"
              step="10"
              value={rowHeight}
              onChange={(e) => setRowHeight(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-sm text-gray-600 w-12">{rowHeight}px</span>
          </div>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* Photo Grid - Justified Layout */}
      <div
        ref={containerRef}
        className="relative bg-gray-50"
        style={{
          height: layout ? `${layout.containerHeight}px` : 'auto',
        }}
      >
        {layout && assets.map((asset, index) => {
          const box = layout.getPosition(index)
          return (
            <div
              key={asset.id}
              className="absolute overflow-hidden"
              style={{
                top: `${box.top}px`,
                left: `${box.left}px`,
                width: `${box.width}px`,
                height: `${box.height}px`,
              }}
            >
              <img
                src={`${immichConfig.baseUrl}/assets/${asset.id}/thumbnail?size=preview&apiKey=${immichConfig.apiKey}`}
                alt={asset.originalFileName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {asset.fileCreatedAt && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-sm">
                  {new Date(asset.fileCreatedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              )}
              {asset.exifInfo?.description && (
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent text-white text-sm">
                  {asset.exifInfo.description}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PhotoGrid
