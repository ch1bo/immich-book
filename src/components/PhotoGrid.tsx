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

  const [rowHeight, setRowHeight] = useState(758) // in pixels
  const [spacing, setSpacing] = useState(20) // in pixels

  // Page settings
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER' | 'A3' | 'CUSTOM'>('CUSTOM')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [margin, setMargin] = useState(118) // in pixels (10mm at 300 DPI)
  const [customWidth, setCustomWidth] = useState(2708) // saal digital default
  const [customHeight, setCustomHeight] = useState(3402) // saal digital default
  const [combinePages, setCombinePages] = useState(true) // combine two pages into one PDF page

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
      customWidth,
      customHeight,
      combinePages,
    })
  }, [assets, pageSize, orientation, margin, rowHeight, spacing, customWidth, customHeight, combinePages])

  // Determine pageLayout based on combinePages setting
  const pageLayout = combinePages ? 'singlePage' : 'twoPageLeft' 

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
                    min="100"
                    max="20000"
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
                    min="100"
                    max="20000"
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
          </div>
        </div>
      </div>

      {/* PDF Preview */}
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
    </div>
  )
}

export default PhotoGrid
