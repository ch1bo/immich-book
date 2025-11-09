import { Document, Page, Image, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { Page as PageData } from '../utils/pageLayout'
import type { ImmichConfig } from './ConnectionForm'

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
        return (
          <Page
            key={pageData.pageNumber}
            dpi={300}
            size={{
              width: pageData.width,
              height: pageData.height,
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
                      left: photoBox.x,
                      top: photoBox.y,
                      width: photoBox.width,
                      height: photoBox.height,
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
