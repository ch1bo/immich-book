import { useState, useEffect, useMemo } from 'react'
import { getAlbumInfo, type AlbumResponseDto, type AssetResponseDto } from '@immich/sdk'
import { PDFViewer, Document, Page, Image, View, Text, StyleSheet } from '@react-pdf/renderer'
import { calculatePageLayout } from '../utils/pageLayout'
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
  const [hoveredRow, setHoveredRow] = useState<{ pageNumber: number; rowIndex: number } | null>(null)

  // Drag state for row height adjustment
  const [dragState, setDragState] = useState<{
    pageNumber: number
    rowIndex: number
    startY: number
    originalHeight: number
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

  // Handle row height drag start
  const handleRowMouseDown = (pageNumber: number, rowIndex: number, originalHeight: number, event: React.MouseEvent) => {
    event.preventDefault()
    setDragState({
      pageNumber,
      rowIndex,
      startY: event.clientY,
      originalHeight,
    })
  }

  // Handle row height drag move
  useEffect(() => {
    if (!dragState) return

    const handleMouseMove = (event: MouseEvent) => {
      const deltaY = event.clientY - dragState.startY
      // Convert from 72 DPI screen to 300 DPI layout (reverse of toPoints)
      const deltaPixels = deltaY * (300 / 72)
      const newHeight = Math.max(100, dragState.originalHeight + deltaPixels)

      // Update the row's customHeight directly in pages state
      setPages(prevPages => {
        return prevPages.map(page => {
          if (page.pageNumber !== dragState.pageNumber) return page

          return {
            ...page,
            rows: page.rows.map((row, idx) => {
              if (idx !== dragState.rowIndex) return row
              return { ...row, customHeight: newHeight }
            })
          }
        })
      })
    }

    const handleMouseUp = () => {
      setDragState(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState])

  // Filter assets based on user preferences
  const filteredAssets = useMemo(() => {
    if (!filterVideos) return assets
    return assets.filter((asset) => asset.type === 'IMAGE')
  }, [assets, filterVideos])

  // Calculate unified page layout - single source of truth!
  const [pages, setPages] = useState<ReturnType<typeof calculatePageLayout>>([])

  // Recalculate layout when parameters change
  useEffect(() => {
    const newPages = calculatePageLayout(filteredAssets, {
      pageSize,
      orientation,
      margin,
      rowHeight,
      spacing,
      customWidth,
      customHeight,
      combinePages,
    })
    setPages(newPages)
  }, [filteredAssets, pageSize, orientation, margin, rowHeight, spacing, customWidth, customHeight, combinePages])

  // Apply custom row heights to calculate adjusted layout
  const adjustedPages = useMemo(() => {
    return pages.map((page) => {
      let cumulativeYOffset = 0
      const adjustedRows = page.rows.map((row) => {
        const effectiveHeight = row.customHeight ?? row.height

        if (row.customHeight) {
          // Calculate scale factor for this row
          const scale = row.customHeight / row.height
          const heightDelta = row.customHeight - row.height

          // Scale photos in this row
          const adjustedPhotos = row.photos.map((photo) => ({
            ...photo,
            y: photo.y + cumulativeYOffset,
            height: photo.height * scale,
          }))

          cumulativeYOffset += heightDelta

          return {
            ...row,
            y: row.y + cumulativeYOffset - heightDelta, // Adjust row position
            height: effectiveHeight,
            photos: adjustedPhotos,
          }
        } else {
          // No custom height, just adjust Y position based on previous changes
          const adjustedPhotos = row.photos.map((photo) => ({
            ...photo,
            y: photo.y + cumulativeYOffset,
          }))

          return {
            ...row,
            y: row.y + cumulativeYOffset,
            photos: adjustedPhotos,
          }
        }
      })

      // Rebuild the photos array from adjusted rows
      const adjustedPhotos = adjustedRows.flatMap((row) => row.photos)

      return {
        ...page,
        rows: adjustedRows,
        photos: adjustedPhotos,
      }
    })
  }, [pages])

  // Determine pageLayout based on combinePages setting
  const pageLayout = combinePages ? 'singlePage' : 'twoPageLeft'

  // Calculate total logical pages for display purposes
  const totalLogicalPages = combinePages ? adjustedPages.length * 2 : adjustedPages.length

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
            {adjustedPages.map((pageData) => {
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
          {adjustedPages.map((page) => {
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

                  return (
                    <div
                      key={photoBox.asset.id}
                      className="absolute overflow-hidden"
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
                    </div>
                  )
                })}

                {/* Row hover overlays */}
                {page.rows.map((row, rowIndex) => {
                  const isHovered = hoveredRow?.pageNumber === page.pageNumber && hoveredRow?.rowIndex === rowIndex
                  const isDragging = dragState?.pageNumber === page.pageNumber && dragState?.rowIndex === rowIndex

                  // Determine which page this row belongs to based on photo X positions
                  // If combined pages: left page (0 to pageWidth) or right page (pageWidth to 2*pageWidth)
                  const firstPhotoX = row.photos[0].x
                  const singlePageWidth = combinePages ? page.width / 2 : page.width
                  const isRightPage = combinePages && firstPhotoX >= singlePageWidth

                  const rowLeft = isRightPage ? singlePageWidth : 0
                  const rowWidth = singlePageWidth

                  return (
                    <div
                      key={rowIndex}
                      className="absolute transition-colors"
                      style={{
                        left: `${toPoints(rowLeft)}px`,
                        top: `${toPoints(row.y)}px`,
                        width: `${toPoints(rowWidth)}px`,
                        height: `${toPoints(row.height)}px`,
                        backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.2)' : isHovered ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        cursor: 'ns-resize',
                      }}
                      onMouseEnter={() => setHoveredRow({ pageNumber: page.pageNumber, rowIndex })}
                      onMouseLeave={() => setHoveredRow(null)}
                      onMouseDown={(e) => handleRowMouseDown(page.pageNumber, rowIndex, row.height, e)}
                    >
                      {(isHovered || isDragging) && (
                        <div className="absolute right-2 top-2 px-3 py-1 bg-blue-600 text-white text-xs rounded shadow-lg flex items-center gap-2">
                          <span>Row {rowIndex + 1}</span>
                          <span className="text-blue-200">|</span>
                          <span>Height: {Math.round(row.height)}px</span>
                          {isDragging && <span className="text-yellow-300">●</span>}
                        </div>
                      )}
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
