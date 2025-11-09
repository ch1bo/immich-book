import { Document, Page, Image, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Page as PageData } from '../utils/pageLayout'
import type { ImmichConfig } from './ConnectionForm'

// Convert 300 DPI pixels to 72 DPI points for PDF
// At 300 DPI: 1 inch = 300 pixels
// At 72 DPI: 1 inch = 72 points
// Conversion: points = pixels * (72/300)
const toPoints = (pixels: number) => pixels * (72 / 300)

interface PDFDocumentProps {
  pages: PageData[]
  immichConfig: ImmichConfig
}

// Create styles for the PDF
const styles =
  StyleSheet.create({
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

export function PDFDocument({ pages, immichConfig }: PDFDocumentProps) {
  return (
    <Document pageLayout='twoPageLeft'>
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
  )
}
