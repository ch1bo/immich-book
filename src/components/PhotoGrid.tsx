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
  dateOverlayTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: 10,
    padding: 8,
    borderRadius: 2,
  },
  dateOverlayBottomRight: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: 10,
    padding: 8,
    borderRadius: 2,
  },
  dateOverlayTopLeftNoFill: {
    position: 'absolute',
    top: 8,
    left: 8,
    color: 'white',
    fontSize: 10,
  },
  dateOverlayTopRightNoFill: {
    position: 'absolute',
    top: 8,
    right: 8,
    color: 'white',
    fontSize: 10,
  },
  descriptionBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: 11,
    padding: 8,
  },
  descriptionTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: 11,
    padding: 8,
  },
  descriptionLeft: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: 11,
    padding: 8,
    display: 'flex',
    justifyContent: 'center',
  },
  descriptionRight: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontSize: 11,
    padding: 8,
    display: 'flex',
    justifyContent: 'center',
  },
  photoContainerFlex: {
    position: 'absolute',
    flexDirection: 'row',
    display: 'flex',
  },
})

function PhotoGrid({ immichConfig, album, onBack }: PhotoGridProps) {
  const [assets, setAssets] = useState<AssetResponseDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'preview' | 'pdf'>('preview')

  const [rowHeight, setRowHeight] = useState(994) // in pixels
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

  // Custom ordering of assets (null = use default order)
  const [customOrdering, setCustomOrdering] = useState<string[] | null>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(`immich-book-ordering-${album.id}`)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Failed to parse stored ordering:', e)
      }
    }
    return null
  })

  // Description positions per asset
  // 'bottom' | 'top' | 'left' | 'right'
  type DescriptionPosition = 'bottom' | 'top' | 'left' | 'right'
  const [descriptionPositions, setDescriptionPositions] = useState<Map<string, DescriptionPosition>>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(`immich-book-description-positions-${album.id}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        return new Map(Object.entries(parsed))
      } catch (e) {
        console.error('Failed to parse stored description positions:', e)
      }
    }
    return new Map()
  })

  // Drag state for reordering
  const [reorderDragState, setReorderDragState] = useState<{
    draggedAssetId: string
    draggedIndex: number
  } | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

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

  // Save custom ordering to localStorage whenever it changes
  useEffect(() => {
    if (customOrdering) {
      localStorage.setItem(`immich-book-ordering-${album.id}`, JSON.stringify(customOrdering))
    } else {
      localStorage.removeItem(`immich-book-ordering-${album.id}`)
    }
  }, [customOrdering, album.id])

  // Save description positions to localStorage whenever they change
  useEffect(() => {
    if (descriptionPositions.size > 0) {
      const obj = Object.fromEntries(descriptionPositions)
      localStorage.setItem(`immich-book-description-positions-${album.id}`, JSON.stringify(obj))
    } else {
      localStorage.removeItem(`immich-book-description-positions-${album.id}`)
    }
  }, [descriptionPositions, album.id])

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

  // Drag & drop handlers for reordering
  const handleReorderDragStart = (assetId: string, index: number, event: React.DragEvent) => {
    event.dataTransfer.effectAllowed = 'move'
    setReorderDragState({ draggedAssetId: assetId, draggedIndex: index })
  }

  const handleReorderDragOver = (index: number, event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetIndex(index)
  }

  const handleReorderDragEnd = () => {
    setReorderDragState(null)
    setDropTargetIndex(null)
  }

  const handleReorderDrop = (targetIndex: number, event: React.DragEvent) => {
    event.preventDefault()

    if (!reorderDragState) return

    const { draggedIndex } = reorderDragState

    if (draggedIndex === targetIndex) {
      handleReorderDragEnd()
      return
    }

    // Create new ordering based on current filtered assets
    const currentOrder = filteredAssets.map(asset => asset.id)
    const newOrder = [...currentOrder]

    // Remove from old position
    const [removed] = newOrder.splice(draggedIndex, 1)
    // Insert at new position
    newOrder.splice(targetIndex, 0, removed)

    setCustomOrdering(newOrder)
    handleReorderDragEnd()
  }

  // Reset ordering to default
  const handleResetOrdering = () => {
    setCustomOrdering(null)
  }

  // Cycle description position
  const handleDescriptionClick = (assetId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const positions: DescriptionPosition[] = ['bottom', 'top', 'left', 'right']
    const currentPosition = descriptionPositions.get(assetId) || 'bottom'
    const currentIndex = positions.indexOf(currentPosition)
    const nextPosition = positions[(currentIndex + 1) % positions.length]

    setDescriptionPositions(prev => {
      const next = new Map(prev)
      if (nextPosition === 'bottom') {
        // Reset to default
        next.delete(assetId)
      } else {
        next.set(assetId, nextPosition)
      }
      return next
    })
  }

  // Filter assets based on user preferences (default order)
  const defaultFilteredAssets = useMemo(() => {
    return filterVideos ? assets.filter((asset) => asset.type === 'IMAGE') : assets
  }, [assets, filterVideos])

  // Apply custom ordering to filtered assets
  const filteredAssets = useMemo(() => {
    if (!customOrdering) return defaultFilteredAssets

    // Create a map for quick lookup
    const assetMap = new Map(defaultFilteredAssets.map(asset => [asset.id, asset]))
    // Reorder based on customOrdering, filtering out any IDs that don't exist
    const reordered = customOrdering
      .map(id => assetMap.get(id))
      .filter((asset): asset is AssetResponseDto => asset !== undefined)

    // Add any assets that aren't in customOrdering at the end
    const orderedIds = new Set(customOrdering)
    const remaining = defaultFilteredAssets.filter(asset => !orderedIds.has(asset.id))

    return [...reordered, ...remaining]
  }, [defaultFilteredAssets, customOrdering])

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
    // Adjust aspect ratios for assets with left/right description positions
    const adjustedAspectRatios = new Map(customAspectRatios)

    filteredAssets.forEach(asset => {
      const descPosition = descriptionPositions.get(asset.id)
      const hasDescription = !!asset.exifInfo?.description

      if (hasDescription && (descPosition === 'left' || descPosition === 'right')) {
        // Double the aspect ratio (make it wider) to account for description space
        const currentRatio = customAspectRatios.get(asset.id)

        if (currentRatio) {
          adjustedAspectRatios.set(asset.id, currentRatio * 2)
        } else {
          // Calculate natural aspect ratio and double it
          const width = asset.exifInfo?.exifImageWidth || 1
          const height = asset.exifInfo?.exifImageHeight || 1
          let naturalRatio = width / height
          if (asset.exifInfo?.orientation === "6") {
            naturalRatio = height / width
          }
          adjustedAspectRatios.set(asset.id, naturalRatio * 2)
        }
      }
    })

    return calculatePageLayout(filteredAssets, {
      pageSize,
      orientation,
      margin,
      rowHeight,
      spacing,
      customWidth,
      customHeight,
      combinePages,
      customAspectRatios: adjustedAspectRatios,
    })
  }, [filteredAssets, pageSize, orientation, margin, rowHeight, spacing, customWidth, customHeight, combinePages, customAspectRatios, descriptionPositions])

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
          {(customAspectRatios.size > 0 || customOrdering !== null) && (
            <div className="mt-2 space-y-2">
              {customAspectRatios.size > 0 && (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <span className="w-2 h-2 bg-blue-500 rounded-full" />
                    {customAspectRatios.size} aspect ratio change{customAspectRatios.size !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={handleResetAllCustomizations}
                    className="text-sm px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded shadow-md transition-colors"
                    title="Reset aspect ratio customizations"
                  >
                    Reset Aspect Ratios
                  </button>
                </div>
              )}
              {customOrdering !== null && (
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Custom ordering
                  </span>
                  <button
                    onClick={handleResetOrdering}
                    className="text-sm px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded shadow-md transition-colors"
                    title="Reset to default ordering"
                  >
                    Reset Ordering
                  </button>
                </div>
              )}
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
                min="100"
                max={customHeight}
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
                    const descPosition = descriptionPositions.get(photoBox.asset.id) || 'bottom'
                    const hasDescription = !!photoBox.asset.exifInfo?.description
                    const isLeftRight = hasDescription && (descPosition === 'left' || descPosition === 'right')

                    // When description is on left/right, photoBox.width is already doubled by the layout algorithm
                    // So we use it as-is and split it between image and description
                    const containerWidth = toPoints(photoBox.width)
                    const imageWidth = isLeftRight ? toPoints(photoBox.width) / 2 : toPoints(photoBox.width)

                    // Use absolute positioning for everything (no flex for left/right)
                    const containerStyle = [
                      styles.photoContainer,
                      {
                        left: toPoints(photoBox.x),
                        top: toPoints(photoBox.y),
                        width: containerWidth,
                        height: toPoints(photoBox.height),
                      },
                    ]

                    return (
                      <View key={photoBox.asset.id} style={containerStyle}>
                        {/* Description on left - absolutely positioned */}
                        {hasDescription && descPosition === 'left' && (
                          <View style={[styles.descriptionLeft, {
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            width: imageWidth,
                            height: toPoints(photoBox.height),
                          }]}>
                            <Text style={{ color: 'white', fontSize: 11 }}>{photoBox.asset.exifInfo.description}</Text>
                          </View>
                        )}

                        {/* Image - absolutely positioned */}
                        <Image
                          src={imageUrl}
                          style={isLeftRight ? {
                            position: 'absolute',
                            left: descPosition === 'left' ? imageWidth : 0,
                            top: 0,
                            width: imageWidth,
                            height: toPoints(photoBox.height),
                            objectFit: 'cover',
                          } : styles.photo}
                        />

                        {/* Description on right - absolutely positioned */}
                        {hasDescription && descPosition === 'right' && (
                          <View style={[styles.descriptionRight, {
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            width: imageWidth,
                            height: toPoints(photoBox.height),
                          }]}>
                            <Text style={{ color: 'white', fontSize: 11 }}>{photoBox.asset.exifInfo.description}</Text>
                          </View>
                        )}

                        {/* Date - absolutely positioned */}
                        {photoBox.asset.fileCreatedAt && (
                          <View style={(() => {
                            switch (descPosition) {
                              case 'bottom':
                                return styles.dateOverlayTopRight
                              case 'top':
                                return styles.dateOverlayBottomRight
                              case 'left':
                                return styles.dateOverlayTopLeftNoFill
                              case 'right':
                                return styles.dateOverlayTopRightNoFill
                              default:
                                return styles.dateOverlayTopRight
                            }
                          })()}>
                            <Text style={{ color: 'white', fontSize: 10 }}>
                              {new Date(photoBox.asset.fileCreatedAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          </View>
                        )}

                        {/* Description for top/bottom positions */}
                        {hasDescription && (descPosition === 'top' || descPosition === 'bottom') && (
                          <Text style={descPosition === 'top' ? styles.descriptionTop : styles.descriptionBottom}>
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

                  // Find global index in filtered assets for drag & drop
                  const globalIndex = filteredAssets.findIndex(a => a.id === photoBox.asset.id)
                  const isBeingDragged = reorderDragState?.draggedAssetId === photoBox.asset.id
                  const isDropTarget = dropTargetIndex === globalIndex

                  // Check if this asset has been reordered (compare to default filtered order)
                  const defaultIndex = defaultFilteredAssets.findIndex(a => a.id === photoBox.asset.id)
                  const isReordered = customOrdering !== null && globalIndex !== defaultIndex

                  const descPosition = descriptionPositions.get(photoBox.asset.id) || 'bottom'
                  const hasDescription = !!photoBox.asset.exifInfo?.description
                  const isLeftRight = hasDescription && (descPosition === 'left' || descPosition === 'right')

                  // When description is on left/right, photoBox.width is already doubled by the layout algorithm
                  // So we use it as-is and split it between image and description
                  const containerWidth = toPoints(photoBox.width)
                  const imageWidth = isLeftRight ? toPoints(photoBox.width) / 2 : toPoints(photoBox.width)

                  return (
                    <div
                      key={photoBox.asset.id}
                      className={`absolute overflow-hidden group cursor-move ${isBeingDragged ? 'opacity-50' : ''} ${isLeftRight ? 'flex' : ''}`}
                      style={{
                        left: `${toPoints(photoBox.x)}px`,
                        top: `${toPoints(photoBox.y)}px`,
                        width: `${containerWidth}px`,
                        height: `${toPoints(photoBox.height)}px`,
                        flexDirection: 'row',
                      }}
                      draggable
                      onDragStart={(e) => handleReorderDragStart(photoBox.asset.id, globalIndex, e)}
                      onDragOver={(e) => handleReorderDragOver(globalIndex, e)}
                      onDragEnd={handleReorderDragEnd}
                      onDrop={(e) => handleReorderDrop(globalIndex, e)}
                    >
                      {/* Drop indicator - shown on left edge when hovering during drag */}
                      {isDropTarget && reorderDragState && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 shadow-lg z-10" />
                      )}

                      {/* Description on left (when position is 'left') */}
                      {hasDescription && descPosition === 'left' && (
                        <div
                          className="bg-black/50 text-white text-sm p-2 cursor-pointer hover:bg-black/70 transition-colors flex items-center justify-center"
                          style={{ width: `${imageWidth}px`, flexShrink: 0 }}
                          onClick={(e) => handleDescriptionClick(photoBox.asset.id, e)}
                          title="Click to change position"
                        >
                          {photoBox.asset.exifInfo.description}
                        </div>
                      )}

                      <img
                        src={imageUrl}
                        alt={photoBox.asset.originalFileName}
                        className="object-cover w-full h-full"
                        style={isLeftRight ? { width: `${imageWidth}px`, flexShrink: 0 } : undefined}
                        loading="lazy"
                      />
                      {photoBox.asset.fileCreatedAt && (() => {
                        const getDateClassName = () => {
                          switch (descPosition) {
                            case 'bottom':
                              return 'absolute top-2 right-2 p-2 bg-black/50 text-white text-xs rounded backdrop-blur-sm'
                            case 'top':
                              return 'absolute bottom-2 right-2 p-2 bg-black/50 text-white text-xs rounded backdrop-blur-sm'
                            case 'left':
                              return 'absolute top-2 left-2 text-white text-xs'
                            case 'right':
                              return 'absolute top-2 right-2 text-white text-xs'
                            default:
                              return 'absolute top-2 right-2 p-2 bg-black/50 text-white text-xs rounded backdrop-blur-sm'
                          }
                        }
                        return (
                          <div className={getDateClassName()}>
                            {new Date(photoBox.asset.fileCreatedAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        )
                      })()}
                      {photoBox.asset.exifInfo?.description && (() => {
                        const descPosition = descriptionPositions.get(photoBox.asset.id) || 'bottom'
                        const description = photoBox.asset.exifInfo.description

                        if (descPosition === 'left' || descPosition === 'right') {
                          // For left/right: description is next to image, not overlaid
                          return null
                        }

                        const getDescriptionConfig = () => {
                          switch (descPosition) {
                            case 'top':
                              return {
                                className: 'absolute top-0 left-0 right-0 bg-black/50 text-white text-sm p-2 cursor-pointer hover:bg-black/70 transition-colors z-10',
                                style: {}
                              }
                            case 'bottom':
                            default:
                              return {
                                className: 'absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm p-2 cursor-pointer hover:bg-black/70 transition-colors z-10',
                                style: {}
                              }
                          }
                        }

                        const config = getDescriptionConfig()

                        return (
                          <div
                            className={config.className}
                            style={config.style}
                            onClick={(e) => handleDescriptionClick(photoBox.asset.id, e)}
                            title="Click to change position"
                          >
                            {description}
                          </div>
                        )
                      })()}

                      {/* Description on right (when position is 'right') */}
                      {hasDescription && descPosition === 'right' && (
                        <div
                          className="bg-black/50 text-white text-sm p-2 cursor-pointer hover:bg-black/70 transition-colors flex items-center justify-center"
                          style={{ width: `${imageWidth}px`, flexShrink: 0 }}
                          onClick={(e) => handleDescriptionClick(photoBox.asset.id, e)}
                          title="Click to change position"
                        >
                          {photoBox.asset.exifInfo.description}
                        </div>
                      )}

                      {/* Customization indicators */}
                      {isCustomized && (
                        <div className="absolute top-2 left-2 w-2 h-2 bg-blue-500 rounded-full shadow-lg" title="Aspect ratio customized" />
                      )}
                      {isReordered && (
                        <div className="absolute top-2 left-5 w-2 h-2 bg-green-500 rounded-full shadow-lg" title="Image reordered" />
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
