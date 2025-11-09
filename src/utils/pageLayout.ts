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

// Convert millimeters to pixels (assuming 300 DPI)
// 1 inch = 25.4 mm = 300 pixels
// 1 mm = 300/25.4 = 11.811023622047244 pixels
export function mmToPixels(mm: number): number {
  return Math.round(mm * 11.811023622047244)
}

// Page sizes in pixels (at 300 DPI)
export const PAGE_SIZES: Record<string, Record<string, PageSize>> = {
  A4: {
    portrait: { width: mmToPixels(210), height: mmToPixels(297), name: 'A4' },    // 210mm x 297mm
    landscape: { width: mmToPixels(297), height: mmToPixels(210), name: 'A4' },
  },
  LETTER: {
    portrait: { width: mmToPixels(215.9), height: mmToPixels(279.4), name: 'LETTER' },    // 8.5" x 11"
    landscape: { width: mmToPixels(279.4), height: mmToPixels(215.9), name: 'LETTER' },
  },
  A3: {
    portrait: { width: mmToPixels(297), height: mmToPixels(420), name: 'A3' },    // 297mm x 420mm
    landscape: { width: mmToPixels(420), height: mmToPixels(297), name: 'A3' },
  },
}

export interface LayoutOptions {
  pageSize: 'A4' | 'LETTER' | 'A3' | 'CUSTOM'
  orientation: 'portrait' | 'landscape'
  margin: number // in pixels
  rowHeight: number // in pixels
  spacing: number // in pixels
  customWidth?: number // in pixels
  customHeight?: number // in pixels
  combinePages?: boolean // combine two pages into one PDF page
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

  const { pageSize, orientation, margin, rowHeight, spacing, customWidth, customHeight } = options

  // Determine page dimensions in pixels
  let pageDimensions: { width: number; height: number }
  if (pageSize === 'CUSTOM' && customWidth && customHeight) {
    pageDimensions = {
      width: customWidth,
      height: customHeight,
    }
  } else if (pageSize !== 'CUSTOM') {
    pageDimensions = PAGE_SIZES[pageSize][orientation]
  } else {
    // Fallback to A4 portrait if custom selected but no dimensions provided
    pageDimensions = PAGE_SIZES.A4.portrait
  }

  const contentWidth = pageDimensions.width - margin * 2
  const contentHeight = pageDimensions.height - margin * 2

  // Calculate aspect ratios for justified layout
  const aspectRatios = new Float32Array(
    assets.map((asset) => {
      const width = asset.exifInfo?.exifImageWidth || 1
      const height = asset.exifInfo?.exifImageHeight || 1
      if (asset.exifInfo?.orientation == "6") {
        return height / width
      }
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

  // Combine pages if requested
  if (options.combinePages) {
    const combinedPages: Page[] = []
    for (let i = 0; i < pages.length; i += 2) {
      const leftPage = pages[i]
      const rightPage = pages[i + 1]

      if (rightPage) {
        // Combine two pages side-by-side
        const combinedPage: Page = {
          pageNumber: Math.floor(i / 2) + 1,
          photos: [
            // Left page photos - keep as is
            ...leftPage.photos,
            // Right page photos - shift horizontally by page width
            ...rightPage.photos.map((photo) => ({
              ...photo,
              x: photo.x + pageDimensions.width,
            })),
          ],
          width: pageDimensions.width * 2,
          height: pageDimensions.height,
        }
        combinedPages.push(combinedPage)
      } else {
        // Odd number of pages - last page stays single
        combinedPages.push({
          ...leftPage,
          pageNumber: Math.floor(i / 2) + 1,
          width: pageDimensions.width * 2, // Keep same width for consistency
        })
      }
    }
    return combinedPages
  }

  return pages
}
