import { useState, useEffect, useMemo } from 'react'
import { getAlbumInfo, type AlbumResponseDto, type AssetResponseDto } from '@immich/sdk'
import { PDFViewer, Document, Page, Image, View, Text, StyleSheet } from '@react-pdf/renderer'
import { calculatePageLayout, PAGE_SIZES } from '../utils/pageLayout'
import type { ImmichConfig } from './ConnectionForm'

interface PhotoGridProps {
  immichConfig: ImmichConfig
  album: AlbumResponseDto
  onBack: () => void
}

// Convert 300 DPI pixels to 72 DPI points for PDF
// At 300 DPI: 1 inch = 300 pixels
// At 72 DPI: 1 inch = 72 points
// Conversion: points = pixels * (72/300)
const toPoints = (pixels: number) => pixels * (72 / 300)

// Create styles for the PDF
const styles = StyleSheet.create({
  page: {
    backgroundColor: 'white',
  },
  photoContainer: {
    position: 'absolute',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  dateOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: 10,
    padding: 4,
    borderRadius: 2,
  },
  descriptionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: 11,
    padding: 8,
  },
})

function PhotoGrid({ immichConfig, album, onBack }: PhotoGridProps) {
  const [assets, setAssets] = useState<AssetResponseDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'preview' | 'pdf'>('preview')

  const [rowHeight, setRowHeight] = useState(900) // in pixels
  const [spacing, setSpacing] = useState(20) // in pixels
  const [filterVideos, setFilterVideos] = useState(true) // exclude videos from layout

  // Custom aspect ratios per asset (for layout manipulation)
  const [customAspectRatios, setCustomAspectRatios] = useState<Map<string, number>>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(`immich-book-aspect-ratios-${album.id}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        return new Map(Object.entries(parsed))
      } catch (e) {
        console.error('Failed to parse stored aspect ratios:', e)
      }
    }
    return new Map()
  })

  // Drag state for aspect ratio adjustment
  const [aspectDragState, setAspectDragState] = useState<{
    assetId: string
    edge: 'left' | 'right'
    startX: number
    originalAspectRatio: number
    originalX: number
    originalWidth: number
  } | null>(null)

  // Page settings
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER' | 'A3' | 'CUSTOM'>('CUSTOM')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [margin, setMargin] = useState(118) // in pixels (10mm at 300 DPI)
  const [customWidth, setCustomWidth] = useState(2515) // saal digital default
  const [customHeight, setCustomHeight] = useState(3260) // saal digital default
  const [combinePages, setCombinePages] = useState(true) // combine two pages into one PDF page

  useEffect(() => {
    loadAlbumAssets()
  }, [album.id])

  // Save custom aspect ratios to localStorage whenever they change
  useEffect(() => {
    if (customAspectRatios.size > 0) {
      const obj = Object.fromEntries(customAspectRatios)
      localStorage.setItem(`immich-book-aspect-ratios-${album.id}`, JSON.stringify(obj))
    } else {
      localStorage.removeItem(`immich-book-aspect-ratios-${album.id}`)
    }
  }, [customAspectRatios, album.id])

  const loadAlbumAssets = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const albumData = await getAlbumInfo({ id: album.id })
      // Sort assets by creation date ascending
      const sorted = albumData.assets.sort((a, b) => {
        return new Date(a.fileCreatedAt).getTime() - new Date(b.fileCreatedAt).getTime()
      })
      setAssets(sorted)
    } catch (err) {
      setError((err as Error).message || 'Failed to load album assets')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle aspect ratio drag start
  const handleAspectDragStart = (
    assetId: string,
    edge: 'left' | 'right',
    aspectRatio: number,
    x: number,
    width: number,
    event: React.MouseEvent
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setAspectDragState({
      assetId,
      edge,
      startX: event.clientX,
      originalAspectRatio: aspectRatio,
      originalX: x,
      originalWidth: width,
    })
  }

  // Reset aspect ratio for a specific asset
  const handleResetAspectRatio = (assetId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setCustomAspectRatios(prev => {
      const next = new Map(prev)
      next.delete(assetId)
      return next
    })
  }

  // Reset all aspect ratio customizations
  const handleResetAllCustomizations = () => {
    setCustomAspectRatios(new Map())
  }

  // Filter assets based on user preferences
  const filteredAssets = useMemo(() => {
    if (!filterVideos) return assets
    return assets.filter((asset) => asset.type === 'IMAGE')
  }, [assets, filterVideos])

  // Calculate content width for snapping
  const contentWidth = useMemo(() => {
    let pageDimensions: { width: number; height: number }
    if (pageSize === 'CUSTOM' && customWidth && customHeight) {
      pageDimensions = { width: customWidth, height: customHeight }
    } else if (pageSize !== 'CUSTOM') {
      pageDimensions = PAGE_SIZES[pageSize][orientation]
    } else {
      pageDimensions = PAGE_SIZES.A4.portrait
    }
    return pageDimensions.width - margin * 2
  }, [pageSize, orientation, margin, customWidth, customHeight])

  // Calculate unified page layout - single source of truth!
  const pages = useMemo(() => {
    return calculatePageLayout(filteredAssets, {
      pageSize,
      orientation,
      margin,
      rowHeight,
      spacing,
      customWidth,
      customHeight,
      combinePages,
      customAspectRatios,
    })
  }, [filteredAssets, pageSize, orientation, margin, rowHeight, spacing, customWidth, customHeight, combinePages, customAspectRatios])

  // Handle aspect ratio drag
  useEffect(() => {
    if (!aspectDragState) return

    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - aspectDragState.startX
      // Convert from 72 DPI screen to 300 DPI layout
      const deltaPixels = deltaX * (300 / 72)

      // Calculate new width based on edge being dragged
      const widthDelta = aspectDragState.edge === 'right' ? deltaPixels : -deltaPixels
      let newWidth = Math.max(50, aspectDragState.originalWidth + widthDelta)

      // Snap to full width when within threshold
      // Determine which page the image is on and snap to that page's right edge
      const snapThreshold = 50
      const singlePageWidth = contentWidth + margin

      // Calculate which page we're on (0-indexed)
      const pageIndex = Math.floor(aspectDragState.originalX / (singlePageWidth + margin))

      // Calculate this page's start X position
      const pageStartX = pageIndex * (singlePageWidth + margin) + margin

      // Calculate right edge relative to this page's start
      const rightEdge = aspectDragState.originalX - pageStartX + newWidth

      if (Math.abs(rightEdge - contentWidth) <= snapThreshold) {
        newWidth = pageStartX + contentWidth - aspectDragState.originalX
      }

      // Calculate new aspect ratio (width stays same height, so aspect ratio changes)
      const heightFromOriginal = aspectDragState.originalWidth / aspectDragState.originalAspectRatio
      const newAspectRatio = newWidth / heightFromOriginal

      setCustomAspectRatios(prev => {
        const next = new Map(prev)
        next.set(aspectDragState.assetId, newAspectRatio)
        return next
      })
    }

    const handleMouseUp = () => {
      setAspectDragState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [aspectDragState, contentWidth, margin])

  // Determine pageLayout based on combinePages setting
  const pageLayout = combinePages ? 'singlePage' : 'twoPageLeft'

  // Calculate total logical pages for display purposes
  const totalLogicalPages = combinePages ? pages.length * 2 : pages.length

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
          <p className="text-gray-600 mt-1">
            {filteredAssets.length} {filteredAssets.length !== assets.length && `of ${assets.length}`} photos
          </p>
          {customAspectRatios.size > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <p className="text-sm text-gray-600">
                {customAspectRatios.size} customization{customAspectRatios.size !== 1 ? 's' : ''}
              </p>
              <button
                onClick={handleResetAllCustomizations}
                className="text-sm px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded shadow-md transition-colors"
                title={`Reset ${customAspectRatios.size} customization${customAspectRatios.size !== 1 ? 's' : ''}`}
              >
                Reset All
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {/* Page settings row */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <label htmlFor="pageSize" className="text-sm text-gray-700">
                Size:
              </label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as 'A4' | 'LETTER' | 'A3' | 'CUSTOM')}
                className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="A4">A4</option>
                <option value="LETTER">Letter</option>
                <option value="A3">A3</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            {pageSize === 'CUSTOM' ? (
              <>
                <div className="flex items-center gap-2">
                  <label htmlFor="customWidth" className="text-sm text-gray-700">
                    Width:
                  </label>
                  <input
                    type="number"
                    id="customWidth"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    min="1000"
                    max="10000"
                    step="1"
                    className="px-2 py-1 w-20 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">px</span>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="customHeight" className="text-sm text-gray-700">
                    Height:
                  </label>
                  <input
                    type="number"
                    id="customHeight"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    min="1000"
                    max="10000"
                    step="1"
                    className="px-2 py-1 w-20 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">px</span>
                </div>
              </>
            ) : (
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
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="combinePages"
                checked={combinePages}
                onChange={(e) => setCombinePages(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="combinePages" className="text-sm text-gray-700">
                Combine Pages
              </label>
            </div>
          </div>

          {/* Layout settings row */}
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              <label htmlFor="margin" className="text-sm text-gray-700">
                Margin:
              </label>
              <input
                type="number"
                id="margin"
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                min="0"
                max="590"
                step="10"
                className="px-2 py-1 w-16 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">px</span>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="rowHeight" className="text-sm text-gray-700">
                Row Height:
              </label>
              <input
                type="number"
                id="rowHeight"
                value={rowHeight}
                onChange={(e) => setRowHeight(Number(e.target.value))}
                min="118"
                max="1181"
                step="10"
                className="px-2 py-1 w-16 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">px</span>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="spacing" className="text-sm text-gray-700">
                Spacing:
              </label>
              <input
                type="number"
                id="spacing"
                value={spacing}
                onChange={(e) => setSpacing(Number(e.target.value))}
                min="0"
                max="100"
                step="1"
                className="px-2 py-1 w-16 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">px</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="filterVideos"
                checked={filterVideos}
                onChange={(e) => setFilterVideos(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="filterVideos" className="text-sm text-gray-700">
                Exclude Videos
              </label>
            </div>
          </div>

          {/* Generate PDF / Back to Edit button */}
          <div className="flex justify-end">
            {mode === 'preview' ? (
              <button
                onClick={() => setMode('pdf')}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Generate PDF
              </button>
            ) : (
              <button
                onClick={() => setMode('preview')}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
              >
                ← Back to Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {mode === 'pdf' ? (
        /* PDF Viewer */
        <div className="w-full" style={{ height: 'calc(100vh - 300px)' }}>
          <PDFViewer width="100%" height="100%" showToolbar={true}>
          <Document pageLayout={pageLayout}>
            {pages.map((pageData) => {
              // FIXME: pdfkit (internal of react-pdf) uses 72dpi internally and we downscale everything here;
              // instead we should produce a high-quality 300 dpi pdf

              // Convert page dimensions from 300 DPI to 72 DPI
              const pageWidth = toPoints(pageData.width)
              const pageHeight = toPoints(pageData.height)
              return (
                <Page
                  key={pageData.pageNumber}
                  size={{
                    width: pageWidth,
                    height: pageHeight,
                  }}
                  style={styles.page}
                >
                  {pageData.photos.map((photoBox) => {
                    const imageUrl = `${immichConfig.baseUrl}/assets/${photoBox.asset.id}/thumbnail?size=preview&apiKey=${immichConfig.apiKey}`

                    return (
                      <View
                        key={photoBox.asset.id}
                        style={[
                          styles.photoContainer,
                          {
                            left: toPoints(photoBox.x),
                            top: toPoints(photoBox.y),
                            width: toPoints(photoBox.width),
                            height: toPoints(photoBox.height),
                          },
                        ]}
                      >
                        <Image src={imageUrl} style={styles.photo} />

                        {photoBox.asset.fileCreatedAt && (
                          <Text style={styles.dateOverlay}>
                            {new Date(photoBox.asset.fileCreatedAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        )}

                        {photoBox.asset.exifInfo?.description && (
                          <Text style={styles.descriptionOverlay}>
                            {photoBox.asset.exifInfo.description}
                          </Text>
                        )}
                      </View>
                    )
                  })}
                </Page>
              )
            })}
          </Document>
        </PDFViewer>
      </div>
      ) : (
        /* Live Preview */
        <div className="space-y-8 pb-8">
          {pages.map((page) => {
            // Scale down to match PDF dimensions (72 DPI from 300 DPI)
            const displayWidth = toPoints(page.width)
            const displayHeight = toPoints(page.height)

            // Calculate page numbers for display
            let pageLabel: string
            if (combinePages) {
              const leftPageNum = page.pageNumber * 2 - 1
              const rightPageNum = page.pageNumber * 2

              // Check if this combined page contains two logical pages or just one
              if (rightPageNum <= totalLogicalPages) {
                pageLabel = `Page ${leftPageNum}/${rightPageNum} of ${totalLogicalPages}`
              } else {
                // Last page with odd number of logical pages
                pageLabel = `Page ${leftPageNum} of ${totalLogicalPages}`
              }
            } else {
              pageLabel = `Page ${page.pageNumber} of ${totalLogicalPages}`
            }

            return (
              <div key={page.pageNumber} className="relative">
                {/* Page number */}
                <div className="text-center mb-2">
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                    {pageLabel}
                  </span>
                </div>

                {/* Page container */}
                <div
                  className="relative bg-white shadow-lg mx-auto"
                  style={{
                    width: `${displayWidth}px`,
                    height: `${displayHeight}px`,
                  }}
                >
                {/* Photos */}
                {page.photos.map((photoBox) => {
                  const imageUrl = `${immichConfig.baseUrl}/assets/${photoBox.asset.id}/thumbnail?size=preview&apiKey=${immichConfig.apiKey}`
                  const isDragging = aspectDragState?.assetId === photoBox.asset.id

                  // Calculate current aspect ratio
                  const naturalWidth = photoBox.asset.exifInfo?.exifImageWidth || 1
                  const naturalHeight = photoBox.asset.exifInfo?.exifImageHeight || 1
                  let currentAspectRatio = naturalWidth / naturalHeight
                  if (photoBox.asset.exifInfo?.orientation == "6") {
                    currentAspectRatio = naturalHeight / naturalWidth
                  }
                  // Use custom aspect ratio if set
                  const aspectRatio = customAspectRatios.get(photoBox.asset.id) || currentAspectRatio
                  const isCustomized = customAspectRatios.has(photoBox.asset.id)

                  return (
                    <div
                      key={photoBox.asset.id}
                      className="absolute overflow-hidden group"
                      style={{
                        left: `${toPoints(photoBox.x)}px`,
                        top: `${toPoints(photoBox.y)}px`,
                        width: `${toPoints(photoBox.width)}px`,
                        height: `${toPoints(photoBox.height)}px`,
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt={photoBox.asset.originalFileName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {photoBox.asset.fileCreatedAt && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded backdrop-blur-sm">
                          {new Date(photoBox.asset.fileCreatedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      )}
                      {photoBox.asset.exifInfo?.description && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm p-2">
                          {photoBox.asset.exifInfo.description}
                        </div>
                      )}

                      {/* Customization indicator */}
                      {isCustomized && (
                        <div className="absolute top-2 left-2 w-2 h-2 bg-blue-500 rounded-full shadow-lg" title="Aspect ratio customized" />
                      )}

                      {/* Reset button - shown on hover for customized images */}
                      {isCustomized && (
                        <div
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded shadow-lg text-xs font-medium"
                          onClick={(e) => handleResetAspectRatio(photoBox.asset.id, e)}
                          title="Reset aspect ratio"
                        >
                          Reset
                        </div>
                      )}

                      {/* Left drag handle */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize transition-colors ${
                          isDragging && aspectDragState.edge === 'left'
                            ? 'bg-blue-500'
                            : 'bg-transparent group-hover:bg-blue-400/50'
                        }`}
                        onMouseDown={(e) => handleAspectDragStart(photoBox.asset.id, 'left', aspectRatio, photoBox.x, photoBox.width, e)}
                      />

                      {/* Right drag handle */}
                      <div
                        className={`absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize transition-colors ${
                          isDragging && aspectDragState.edge === 'right'
                            ? 'bg-blue-500'
                            : 'bg-transparent group-hover:bg-blue-400/50'
                        }`}
                        onMouseDown={(e) => handleAspectDragStart(photoBox.asset.id, 'right', aspectRatio, photoBox.x, photoBox.width, e)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PhotoGrid
