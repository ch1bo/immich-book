import { JustifiedLayout } from '@immich/justified-layout-wasm'
import type { AssetResponseDto } from '@immich/sdk'

export interface PageSize {
  width: number // in pixels
  height: number // in pixels
  name: 'A4' | 'LETTER' | 'A3'
}

export interface PhotoBox {
  asset: AssetResponseDto
  x: number
  y: number
  width: number
  height: number
}

export interface Page {
  pageNumber: number
  photos: PhotoBox[]
  width: number
  height: number
}

// Page sizes in pixels at 96 DPI (web) - will be converted for print
export const PAGE_SIZES: Record<string, Record<string, PageSize>> = {
  A4: {
    portrait: { width: 794, height: 1123, name: 'A4' },
    landscape: { width: 1123, height: 794, name: 'A4' },
  },
  LETTER: {
    portrait: { width: 816, height: 1056, name: 'LETTER' },
    landscape: { width: 1056, height: 816, name: 'LETTER' },
  },
  A3: {
    portrait: { width: 1123, height: 1587, name: 'A3' },
    landscape: { width: 1587, height: 1123, name: 'A3' },
  },
}

export interface LayoutOptions {
  pageSize: 'A4' | 'LETTER' | 'A3'
  orientation: 'portrait' | 'landscape'
  margin: number
  rowHeight: number
  spacing: number
}

/**
 * Calculate page-based layout for photos
 * This is the single source of truth for layout - used by both web and PDF
 */
export function calculatePageLayout(
  assets: AssetResponseDto[],
  options: LayoutOptions
): Page[] {
  if (assets.length === 0) return []

  const { pageSize, orientation, margin, rowHeight, spacing } = options
  const pageDimensions = PAGE_SIZES[pageSize][orientation]
  const contentWidth = pageDimensions.width - margin * 2
  const contentHeight = pageDimensions.height - margin * 2

  // Calculate aspect ratios for justified layout
  const aspectRatios = new Float32Array(
    assets.map((asset) => {
      const width = asset.exifInfo?.exifImageWidth || 1
      const height = asset.exifInfo?.exifImageHeight || 1
      return width / height
    })
  )

  // Run justified layout algorithm
  const justifiedLayout = new JustifiedLayout(aspectRatios, {
    rowHeight,
    rowWidth: contentWidth,
    spacing,
    heightTolerance: 0.1,
  })

  // Convert justified layout positions to page-based layout
  const pages: Page[] = []
  let currentPage: Page = {
    pageNumber: 1,
    photos: [],
    width: pageDimensions.width,
    height: pageDimensions.height,
  }
  let currentPageY = 0

  for (let i = 0; i < assets.length; i++) {
    const box = justifiedLayout.getPosition(i)
    const asset = assets[i]

    // Check if photo fits on current page
    const photoBottom = box.top + box.height

    if (currentPage.photos.length > 0 && photoBottom - currentPageY > contentHeight) {
      // Start a new page
      pages.push(currentPage)
      currentPage = {
        pageNumber: pages.length + 1,
        photos: [],
        width: pageDimensions.width,
        height: pageDimensions.height,
      }
      currentPageY = box.top
    }

    // Add photo to current page (adjust Y relative to page)
    currentPage.photos.push({
      asset,
      x: box.left + margin,
      y: box.top - currentPageY + margin,
      width: box.width,
      height: box.height,
    })
  }

  // Add the last page
  if (currentPage.photos.length > 0) {
    pages.push(currentPage)
  }

  return pages
}
