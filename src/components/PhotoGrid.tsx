import { useState, useEffect, useMemo } from 'react'
import { getAlbumInfo, type AlbumResponseDto, type AssetResponseDto } from '@immich/sdk'
import { calculatePageLayout } from '../utils/pageLayout'
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
  const [rowHeight, setRowHeight] = useState(250)
  const spacing = 4 // Fixed spacing between photos

  // Page settings
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER' | 'A3'>('A4')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [margin, setMargin] = useState(50)

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
      setError((err as Error).message || 'Failed to load album assets')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate unified page layout - single source of truth!
  const pages = useMemo(() => {
    return calculatePageLayout(assets, {
      pageSize,
      orientation,
      margin,
      rowHeight,
      spacing,
    })
  }, [assets, pageSize, orientation, margin, rowHeight, spacing])

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

        <div className="flex flex-col gap-4">
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
          </div>

          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm font-semibold text-gray-700">PDF Export:</span>

            <div className="flex items-center gap-2">
              <label htmlFor="pageSize" className="text-sm text-gray-700">
                Size:
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as 'A4' | 'LETTER' | 'A3')}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="A4">A4</option>
                <option value="LETTER">Letter</option>
                <option value="A3">A3</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="orientation" className="text-sm text-gray-700">
                Orientation:
              </label>
              <select
                id="orientation"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="margin" className="text-sm text-gray-700">
                Margin:
              </label>
              <input
                type="number"
                id="margin"
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                min="10"
                max="100"
                step="5"
                className="px-2 py-1 w-16 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">px</span>
            </div>

            <button
              onClick={handlePrint}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* Photo Book Pages */}
      <div className="space-y-8">
        {pages.map((page, pageIndex) => (
          <div key={page.pageNumber} className="relative">
            {/* Page container */}
            <div
              className="relative bg-white shadow-lg mx-auto print-page"
              style={{
                width: `${page.width}px`,
                height: `${page.height}px`,
              }}
            >
              {/* Page number (visible in preview only) */}
              <div className="absolute top-4 left-4 no-print px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                Page {page.pageNumber} of {pages.length}
              </div>

              {/* Photos */}
              {page.photos.map((photoBox) => (
                <div
                  key={photoBox.asset.id}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${photoBox.x}px`,
                    top: `${photoBox.y}px`,
                    width: `${photoBox.width}px`,
                    height: `${photoBox.height}px`,
                  }}
                >
                  <img
                    src={`${immichConfig.baseUrl}/assets/${photoBox.asset.id}/thumbnail?size=preview&apiKey=${immichConfig.apiKey}`}
                    alt={photoBox.asset.originalFileName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {photoBox.asset.fileCreatedAt && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-sm">
                      {new Date(photoBox.asset.fileCreatedAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  )}
                  {photoBox.asset.exifInfo?.description && (
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/70 to-transparent text-white text-sm">
                      {photoBox.asset.exifInfo.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PhotoGrid
