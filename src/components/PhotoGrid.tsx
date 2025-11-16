import { useState, useEffect, useMemo } from "react";
import {
  getAlbumInfo,
  type AlbumResponseDto,
  type AssetResponseDto,
} from "@immich/sdk";
import {
  PDFViewer,
  Document,
  Page,
  Image,
  View,
  Text,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { calculatePageLayout, PAGE_SIZES } from "../utils/pageLayout";
import type { ImmichConfig } from "./ConnectionForm";
import roboto400 from "@fontsource/roboto/files/roboto-latin-400-normal.woff?url";
import roboto500 from "@fontsource/roboto/files/roboto-latin-500-normal.woff?url";

// Register Roboto font for PDF using local bundled files
Font.register({
  family: "Roboto",
  fonts: [
    { src: roboto400, fontWeight: 400 },
    { src: roboto500, fontWeight: 500 },
  ],
});

interface PhotoGridProps {
  immichConfig: ImmichConfig;
  album: AlbumResponseDto;
  onBack: () => void;
}

interface GlobalConfig {
  // Page settings
  pageSize: "A4" | "LETTER" | "A3" | "CUSTOM";
  orientation: "portrait" | "landscape";
  pageWidth: number;
  pageHeight: number;
  margin: number;
  combinePages: boolean;

  // Layout settings
  rowHeight: number;
  spacing: number;
  filterVideos: boolean;

  // Display settings
  showDates: boolean;
  showDescriptions: boolean;
}

interface AlbumConfig extends GlobalConfig {
  // Customizations (album-specific only)
  customAspectRatios: Record<string, number>;
  customOrdering: string[] | null;
  descriptionPositions: Record<string, "bottom" | "top" | "left" | "right">;
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  pageSize: "CUSTOM",
  orientation: "portrait",
  pageWidth: 2515,
  pageHeight: 3260,
  margin: 118,
  combinePages: true,
  rowHeight: 994,
  spacing: 20,
  filterVideos: true,
  showDates: true,
  showDescriptions: true,
};

const DEFAULT_ALBUM_CONFIG: AlbumConfig = {
  ...DEFAULT_GLOBAL_CONFIG,
  customAspectRatios: {},
  customOrdering: null,
  descriptionPositions: {},
};

// Helper functions for config persistence
function loadGlobalConfig(): GlobalConfig {
  try {
    const stored = localStorage.getItem("immich-book-global-config");
    if (stored) {
      return { ...DEFAULT_GLOBAL_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error("Failed to load global config:", e);
  }
  return DEFAULT_GLOBAL_CONFIG;
}

function saveGlobalConfig(config: GlobalConfig) {
  try {
    localStorage.setItem("immich-book-global-config", JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save global config:", e);
  }
}

function loadAlbumConfig(albumId: string): AlbumConfig {
  const globalConfig = loadGlobalConfig();

  try {
    const stored = localStorage.getItem(`immich-book-config-${albumId}`);
    if (stored) {
      const albumSpecific = JSON.parse(stored);
      return {
        ...globalConfig,
        customAspectRatios: {},
        customOrdering: null,
        descriptionPositions: {},
        ...albumSpecific,
      };
    }
  } catch (e) {
    console.error("Failed to load album config:", e);
  }

  return {
    ...globalConfig,
    customAspectRatios: {},
    customOrdering: null,
    descriptionPositions: {},
  };
}

function saveAlbumConfig(albumId: string, config: AlbumConfig) {
  try {
    localStorage.setItem(
      `immich-book-config-${albumId}`,
      JSON.stringify(config),
    );

    // Also update global config with page and layout settings
    const globalConfig: GlobalConfig = {
      pageSize: config.pageSize,
      orientation: config.orientation,
      pageWidth: config.pageWidth,
      pageHeight: config.pageHeight,
      margin: config.margin,
      combinePages: config.combinePages,
      rowHeight: config.rowHeight,
      spacing: config.spacing,
      filterVideos: config.filterVideos,
      showDates: config.showDates,
      showDescriptions: config.showDescriptions,
    };
    saveGlobalConfig(globalConfig);
  } catch (e) {
    console.error("Failed to save album config:", e);
  }
}

// Convert 300 DPI pixels to 72 DPI points for PDF
// At 300 DPI: 1 inch = 300 pixels
// At 72 DPI: 1 inch = 72 points
// Conversion: points = pixels * (72/300)
const toPoints = (pixels: number) => pixels * (72 / 300);

// Create styles for the PDF
const styles = StyleSheet.create({
  page: {
    backgroundColor: "white",
  },
  photoContainer: {
    position: "absolute",
  },
  photo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  dateOverlayTopRight: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    color: "white",
    fontSize: 12,
    padding: 8,
    borderRadius: 2,
    fontFamily: "Roboto",
  },
  dateOverlayBottomRight: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    color: "white",
    fontSize: 12,
    padding: 8,
    borderRadius: 2,
    fontFamily: "Roboto",
  },
  descriptionBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    color: "white",
    fontSize: 14,
    padding: 8,
    fontFamily: "Roboto",
  },
  descriptionTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    color: "white",
    fontSize: 14,
    padding: 8,
    fontFamily: "Roboto",
  },
  descriptionLeft: {
    fontSize: 14,
    padding: 8,
    display: "flex",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    fontFamily: "Roboto",
  },
  descriptionRight: {
    fontSize: 14,
    padding: 8,
    display: "flex",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    fontFamily: "Roboto",
  },
  photoContainerFlex: {
    position: "absolute",
    flexDirection: "row",
    display: "flex",
  },
});

function PhotoGrid({ immichConfig, album, onBack }: PhotoGridProps) {
  const [assets, setAssets] = useState<AssetResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"preview" | "pdf">("preview");

  // Load config on mount
  const initialConfig = useMemo(() => loadAlbumConfig(album.id), [album.id]);

  // Page settings
  const [pageSize, setPageSize] = useState<"A4" | "LETTER" | "A3" | "CUSTOM">(
    initialConfig.pageSize,
  );
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    initialConfig.orientation,
  );
  const [pageWidth, setPageWidth] = useState(initialConfig.pageWidth);
  const [pageHeight, setPageHeight] = useState(initialConfig.pageHeight);
  const [margin, setMargin] = useState(initialConfig.margin);
  const [combinePages, setCombinePages] = useState(initialConfig.combinePages);

  // Layout settings
  const [rowHeight, setRowHeight] = useState(initialConfig.rowHeight);
  const [spacing, setSpacing] = useState(initialConfig.spacing);
  const [filterVideos, setFilterVideos] = useState(initialConfig.filterVideos);

  // Validation helpers
  const isPageWidthValid = pageWidth >= 1000 && pageWidth <= 10000;
  const isPageHeightValid = pageHeight >= 1000 && pageHeight <= 10000;
  const isMarginValid = margin >= 0 && margin <= pageWidth / 2;
  const isRowHeightValid = rowHeight >= 300 && rowHeight <= pageHeight;
  const isSpacingValid = spacing >= 0 && spacing <= 100;

  // Clamped values for use in layout calculations (prevent crashes from invalid values)
  const validPageWidth = isPageWidthValid
    ? pageWidth
    : Math.max(1000, Math.min(10000, pageWidth));
  const validPageHeight = isPageHeightValid
    ? pageHeight
    : Math.max(1000, Math.min(10000, pageHeight));
  const validMargin = isMarginValid
    ? margin
    : Math.max(0, Math.min(validPageWidth / 2, margin));
  const validRowHeight = isRowHeightValid
    ? rowHeight
    : Math.max(300, Math.min(validPageHeight, rowHeight));
  const validSpacing = isSpacingValid
    ? spacing
    : Math.max(0, Math.min(100, spacing));

  // Display settings
  const [showDates, setShowDates] = useState(initialConfig.showDates);
  const [showDescriptions, setShowDescriptions] = useState(
    initialConfig.showDescriptions,
  );

  // Customizations
  const [customAspectRatios, setCustomAspectRatios] = useState<
    Map<string, number>
  >(() => new Map(Object.entries(initialConfig.customAspectRatios)));
  const [customOrdering, setCustomOrdering] = useState<string[] | null>(
    initialConfig.customOrdering,
  );
  const [descriptionPositions, setDescriptionPositions] = useState<
    Map<string, "bottom" | "top" | "left" | "right">
  >(() => new Map(Object.entries(initialConfig.descriptionPositions)));

  // Drag state for reordering
  const [reorderDragState, setReorderDragState] = useState<{
    draggedAssetId: string;
    draggedIndex: number;
  } | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Drag state for aspect ratio adjustment
  const [aspectDragState, setAspectDragState] = useState<{
    assetId: string;
    edge: "left" | "right";
    startX: number;
    originalAspectRatio: number;
    originalX: number;
    originalWidth: number;
  } | null>(null);

  // Update page dimensions when size or orientation changes
  useEffect(() => {
    if (pageSize !== "CUSTOM") {
      const dimensions = PAGE_SIZES[pageSize][orientation];
      setPageWidth(dimensions.width);
      setPageHeight(dimensions.height);
    }
  }, [pageSize, orientation]);

  useEffect(() => {
    loadAlbumAssets();

    // Clean up old localStorage keys (migration)
    localStorage.removeItem(`immich-book-aspect-ratios-${album.id}`);
    localStorage.removeItem(`immich-book-ordering-${album.id}`);
    localStorage.removeItem(`immich-book-description-positions-${album.id}`);
  }, [album.id]);

  // Save config to localStorage whenever it changes (with clamped values)
  useEffect(() => {
    // Only save if all values are valid
    if (
      !isPageWidthValid ||
      !isPageHeightValid ||
      !isMarginValid ||
      !isRowHeightValid ||
      !isSpacingValid
    ) {
      return;
    }

    const config: AlbumConfig = {
      pageSize,
      orientation,
      pageWidth,
      pageHeight,
      margin,
      combinePages,
      rowHeight,
      spacing,
      filterVideos,
      showDates,
      showDescriptions,
      customAspectRatios: Object.fromEntries(customAspectRatios),
      customOrdering,
      descriptionPositions: Object.fromEntries(descriptionPositions),
    };
    saveAlbumConfig(album.id, config);
  }, [
    album.id,
    pageSize,
    orientation,
    pageWidth,
    pageHeight,
    margin,
    combinePages,
    rowHeight,
    spacing,
    filterVideos,
    showDates,
    showDescriptions,
    customAspectRatios,
    customOrdering,
    descriptionPositions,
    isPageWidthValid,
    isPageHeightValid,
    isMarginValid,
    isRowHeightValid,
    isSpacingValid,
  ]);

  const loadAlbumAssets = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const albumData = await getAlbumInfo({ id: album.id });
      // Sort assets by creation date ascending
      const sorted = albumData.assets.sort((a, b) => {
        return (
          new Date(a.fileCreatedAt).getTime() -
          new Date(b.fileCreatedAt).getTime()
        );
      });
      setAssets(sorted);
    } catch (err) {
      setError((err as Error).message || "Failed to load album assets");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle aspect ratio drag start
  const handleAspectDragStart = (
    assetId: string,
    edge: "left" | "right",
    aspectRatio: number,
    x: number,
    width: number,
    event: React.MouseEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setAspectDragState({
      assetId,
      edge,
      startX: event.clientX,
      originalAspectRatio: aspectRatio,
      originalX: x,
      originalWidth: width,
    });
  };

  // Reset aspect ratio for a specific asset
  const handleResetAspectRatio = (assetId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setCustomAspectRatios((prev) => {
      const next = new Map(prev);
      next.delete(assetId);
      return next;
    });
  };

  // Reset all aspect ratio customizations
  const handleResetAllCustomizations = () => {
    setCustomAspectRatios(new Map());
  };

  // Drag & drop handlers for reordering
  const handleReorderDragStart = (
    assetId: string,
    index: number,
    event: React.DragEvent,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    setReorderDragState({ draggedAssetId: assetId, draggedIndex: index });
  };

  const handleReorderDragOver = (index: number, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetIndex(index);
  };

  const handleReorderDragEnd = () => {
    setReorderDragState(null);
    setDropTargetIndex(null);
  };

  const handleReorderDrop = (targetIndex: number, event: React.DragEvent) => {
    event.preventDefault();

    if (!reorderDragState) return;

    const { draggedIndex } = reorderDragState;

    if (draggedIndex === targetIndex) {
      handleReorderDragEnd();
      return;
    }

    // Create new ordering based on current filtered assets
    const currentOrder = filteredAssets.map((asset) => asset.id);
    const newOrder = [...currentOrder];

    // Remove from old position
    const [removed] = newOrder.splice(draggedIndex, 1);
    // Insert at new position
    newOrder.splice(targetIndex, 0, removed);

    setCustomOrdering(newOrder);
    handleReorderDragEnd();
  };

  // Reset ordering to default
  const handleResetOrdering = () => {
    setCustomOrdering(null);
  };

  // Reset all description position customizations
  const handleResetDescriptionPositions = () => {
    setDescriptionPositions(new Map());
  };

  // Cycle description position
  const handleDescriptionClick = (assetId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const positions: DescriptionPosition[] = ["bottom", "top", "left", "right"];
    const currentPosition = descriptionPositions.get(assetId) || "bottom";
    const currentIndex = positions.indexOf(currentPosition);
    const nextPosition = positions[(currentIndex + 1) % positions.length];

    setDescriptionPositions((prev) => {
      const next = new Map(prev);
      if (nextPosition === "bottom") {
        // Reset to default
        next.delete(assetId);
      } else {
        next.set(assetId, nextPosition);
      }
      return next;
    });
  };

  // Filter assets based on user preferences (default order)
  const defaultFilteredAssets = useMemo(() => {
    return filterVideos
      ? assets.filter((asset) => asset.type === "IMAGE")
      : assets;
  }, [assets, filterVideos]);

  // Apply custom ordering to filtered assets
  const filteredAssets = useMemo(() => {
    if (!customOrdering) return defaultFilteredAssets;

    // Create a map for quick lookup
    const assetMap = new Map(
      defaultFilteredAssets.map((asset) => [asset.id, asset]),
    );
    // Reorder based on customOrdering, filtering out any IDs that don't exist
    const reordered = customOrdering
      .map((id) => assetMap.get(id))
      .filter((asset): asset is AssetResponseDto => asset !== undefined);

    // Add any assets that aren't in customOrdering at the end
    const orderedIds = new Set(customOrdering);
    const remaining = defaultFilteredAssets.filter(
      (asset) => !orderedIds.has(asset.id),
    );

    return [...reordered, ...remaining];
  }, [defaultFilteredAssets, customOrdering]);

  // Calculate content width for snapping
  const contentWidth = useMemo(() => {
    return validPageWidth - validMargin * 2;
  }, [validPageWidth, validMargin]);

  // Calculate unified page layout - single source of truth!
  const pages = useMemo(() => {
    // Adjust aspect ratios for assets with left/right description positions
    const adjustedAspectRatios = new Map(customAspectRatios);

    filteredAssets.forEach((asset) => {
      const descPosition = descriptionPositions.get(asset.id);
      const hasDescription = showDescriptions && !!asset.exifInfo?.description;

      if (
        hasDescription &&
        (descPosition === "left" || descPosition === "right")
      ) {
        // Double the aspect ratio (make it wider) to account for description space
        const currentRatio = customAspectRatios.get(asset.id);

        if (currentRatio) {
          adjustedAspectRatios.set(asset.id, currentRatio * 2);
        } else {
          // Calculate natural aspect ratio and double it
          const width = asset.exifInfo?.exifImageWidth || 1;
          const height = asset.exifInfo?.exifImageHeight || 1;
          let naturalRatio = width / height;
          if (asset.exifInfo?.orientation === "6") {
            naturalRatio = height / width;
          }
          adjustedAspectRatios.set(asset.id, naturalRatio * 2);
        }
      }
    });

    return calculatePageLayout(filteredAssets, {
      pageSize: "CUSTOM",
      orientation: "portrait",
      margin: validMargin,
      rowHeight: validRowHeight,
      spacing: validSpacing,
      customWidth: validPageWidth,
      customHeight: validPageHeight,
      combinePages,
      customAspectRatios: adjustedAspectRatios,
    });
  }, [
    filteredAssets,
    validMargin,
    validRowHeight,
    validSpacing,
    validPageWidth,
    validPageHeight,
    combinePages,
    customAspectRatios,
    descriptionPositions,
    showDescriptions,
  ]);

  // Handle aspect ratio drag
  useEffect(() => {
    if (!aspectDragState) return;

    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - aspectDragState.startX;
      // Convert from 72 DPI screen to 300 DPI layout
      const deltaPixels = deltaX * (300 / 72);

      // Calculate new width based on edge being dragged
      const widthDelta =
        aspectDragState.edge === "right" ? deltaPixels : -deltaPixels;
      let newWidth = Math.max(50, aspectDragState.originalWidth + widthDelta);

      // Snap to full width when within threshold
      // Determine which page the image is on and snap to that page's right edge
      const snapThreshold = 50;
      const singlePageWidth = contentWidth + validMargin;

      // Calculate which page we're on (0-indexed)
      const pageIndex = Math.floor(
        aspectDragState.originalX / (singlePageWidth + validMargin),
      );

      // Calculate this page's start X position
      const pageStartX = pageIndex * (singlePageWidth + validMargin) + validMargin;

      // Calculate right edge relative to this page's start
      const rightEdge = aspectDragState.originalX - pageStartX + newWidth;

      if (Math.abs(rightEdge - contentWidth) <= snapThreshold) {
        newWidth = pageStartX + contentWidth - aspectDragState.originalX;
      }

      // Calculate new aspect ratio (width stays same height, so aspect ratio changes)
      const heightFromOriginal =
        aspectDragState.originalWidth / aspectDragState.originalAspectRatio;
      const newAspectRatio = newWidth / heightFromOriginal;

      setCustomAspectRatios((prev) => {
        const next = new Map(prev);
        next.set(aspectDragState.assetId, newAspectRatio);
        return next;
      });
    };

    const handleMouseUp = () => {
      setAspectDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [aspectDragState, contentWidth, margin]);

  // Determine pageLayout based on combinePages setting
  const pageLayout = combinePages ? "singlePage" : "twoPageLeft";

  // Calculate total logical pages for display purposes
  const totalLogicalPages = combinePages ? pages.length * 2 : pages.length;

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-4 text-gray-600">Loading photos...</p>
      </div>
    );
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
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm transition-colors shadow-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-col lg:flex-row flex-1 items-start lg:justify-between gap-4 lg:gap-8">
        <div className="w-full lg:w-auto">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Back to albums
          </button>
          <h2 className="text-2xl font-semibold">{album.albumName}</h2>
          <p className="text-gray-600 mt-1">
            {filteredAssets.length}{" "}
            {filteredAssets.length !== assets.length && `of ${assets.length}`}{" "}
            assets
          </p>

          {/* Generate PDF / Back to Edit button */}
          <div className="mt-4">
            {mode === "preview" ? (
              <button
                onClick={() => setMode("pdf")}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
              >
                Generate PDF
              </button>
            ) : (
              <button
                onClick={() => setMode("preview")}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors shadow-sm"
              >
                Back to Edit
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 w-full lg:w-auto">
          {/* 1. Page Setup */}
          <div className="p-2 bg-gray-50 rounded border border-gray-300">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h3 className="text-xs font-semibold text-gray-700 sm:w-28">
                Page
              </h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-1">
                <div className="flex items-center gap-1">
                  <label htmlFor="pageWidth" className="text-gray-600 text-xs">
                    Width:
                  </label>
                  <input
                    type="number"
                    id="pageWidth"
                    value={pageWidth}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (!isNaN(value)) {
                        setPageWidth(value);
                      }
                    }}
                    min="1000"
                    max="10000"
                    className={`px-1 py-0.5 w-16 text-xs border rounded ${
                      isPageWidthValid
                        ? "border-gray-300"
                        : "border-red-500 bg-red-50"
                    }`}
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
                <div className="flex items-center gap-1">
                  <label htmlFor="pageHeight" className="text-gray-600 text-xs">
                    Height:
                  </label>
                  <input
                    type="number"
                    id="pageHeight"
                    value={pageHeight}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (!isNaN(value)) {
                        setPageHeight(value);
                      }
                    }}
                    min="1000"
                    max="10000"
                    className={`px-1 py-0.5 w-16 text-xs border rounded ${
                      isPageHeightValid
                        ? "border-gray-300"
                        : "border-red-500 bg-red-50"
                    }`}
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    id="combinePages"
                    checked={combinePages}
                    onChange={(e) => setCombinePages(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <label
                    htmlFor="combinePages"
                    className="text-xs text-gray-700"
                  >
                    Combine Pages
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Layout */}
          <div className="p-2 bg-gray-50 rounded border border-gray-300">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h3 className="text-xs font-semibold text-gray-700 sm:w-28">
                Layout
              </h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-1">
                <div className="flex items-center gap-1">
                  <label htmlFor="margin" className="text-gray-600 text-xs">
                    Margin:
                  </label>
                  <input
                    type="number"
                    id="margin"
                    value={margin}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (!isNaN(value)) {
                        setMargin(value);
                      }
                    }}
                    min="0"
                    max={pageWidth / 2}
                    step="10"
                    className={`px-1 py-0.5 w-14 text-xs border rounded ${
                      isMarginValid
                        ? "border-gray-300"
                        : "border-red-500 bg-red-50"
                    }`}
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
                <div className="flex items-center gap-1">
                  <label htmlFor="rowHeight" className="text-gray-600 text-xs">
                    Row Height:
                  </label>
                  <input
                    type="number"
                    id="rowHeight"
                    value={rowHeight}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (!isNaN(value)) {
                        setRowHeight(value);
                      }
                    }}
                    min="300"
                    max={pageHeight}
                    step="10"
                    className={`px-1 py-0.5 w-14 text-xs border rounded ${
                      isRowHeightValid
                        ? "border-gray-300"
                        : "border-red-500 bg-red-50"
                    }`}
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
                <div className="flex items-center gap-1">
                  <label htmlFor="spacing" className="text-gray-600 text-xs">
                    Spacing:
                  </label>
                  <input
                    type="number"
                    id="spacing"
                    value={spacing}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (!isNaN(value)) {
                        setSpacing(value);
                      }
                    }}
                    min="0"
                    max="100"
                    className={`px-1 py-0.5 w-12 text-xs border rounded ${
                      isSpacingValid
                        ? "border-gray-300"
                        : "border-red-500 bg-red-50"
                    }`}
                  />
                  <span className="text-xs text-gray-500">px</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Presentation */}
          <div className="p-2 bg-gray-50 rounded border border-gray-300">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h3 className="text-xs font-semibold text-gray-700 sm:w-28">
                Presentation
              </h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    id="filterVideos"
                    checked={filterVideos}
                    onChange={(e) => setFilterVideos(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <label
                    htmlFor="filterVideos"
                    className="text-xs text-gray-700"
                  >
                    Exclude Videos
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    id="showDates"
                    checked={showDates}
                    onChange={(e) => setShowDates(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <label htmlFor="showDates" className="text-xs text-gray-700">
                    Show Dates
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    id="showDescriptions"
                    checked={showDescriptions}
                    onChange={(e) => setShowDescriptions(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <label
                    htmlFor="showDescriptions"
                    className="text-xs text-gray-700"
                  >
                    Show Descriptions
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Customizations (only shown when there are any) */}
          {(customAspectRatios.size > 0 ||
            customOrdering !== null ||
            descriptionPositions.size > 0) && (
            <div className="p-2 bg-gray-50 rounded border border-gray-300">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h3 className="text-xs font-semibold text-gray-700 sm:w-28">
                  Customizations
                </h3>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {customOrdering !== null && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                        Custom order
                      </span>
                      <button
                        onClick={handleResetOrdering}
                        className="text-xs px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors font-medium"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                  {customAspectRatios.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        {customAspectRatios.size} aspect ratio
                      </span>
                      <button
                        onClick={handleResetAllCustomizations}
                        className="text-xs px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors font-medium"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                  {descriptionPositions.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <span className="w-2 h-2 bg-purple-500 rounded-full" />
                        {descriptionPositions.size} label position
                      </span>
                      <button
                        onClick={handleResetDescriptionPositions}
                        className="text-xs px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors font-medium"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {mode === "pdf" ? (
        /* PDF Viewer */
        <div
          className="w-full"
          style={{ height: "calc(100vh - 200px)", minHeight: "400px" }}
        >
          <PDFViewer width="100%" height="100%" showToolbar={true}>
            <Document pageLayout={pageLayout}>
              {pages.map((pageData) => {
                // FIXME: pdfkit (internal of react-pdf) uses 72dpi internally and we downscale everything here;
                // instead we should produce a high-quality 300 dpi pdf

                // Convert page dimensions from 300 DPI to 72 DPI
                const pageWidth = toPoints(pageData.width);
                const pageHeight = toPoints(pageData.height);
                return (
                  <Page
                    key={pageData.pageNumber}
                    size={{
                      width: pageWidth,
                      height: pageHeight,
                    }}
                    style={styles.page}
                  >
                    {/* Page break indicator for combined pages */}
                    {combinePages && (
                      <View
                        style={{
                          position: "absolute",
                          left: pageWidth / 2,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          borderLeft: "1 dashed #D1D5DB",
                        }}
                      />
                    )}

                    {pageData.photos.map((photoBox) => {
                      const imageUrl = `${immichConfig.baseUrl}/assets/${photoBox.asset.id}/thumbnail?size=preview&apiKey=${immichConfig.apiKey}`;
                      const descPosition =
                        descriptionPositions.get(photoBox.asset.id) || "bottom";
                      const hasDescription =
                        showDescriptions &&
                        !!photoBox.asset.exifInfo?.description;
                      const isLeftRight =
                        hasDescription &&
                        (descPosition === "left" || descPosition === "right");

                      // When description is on left/right, photoBox.width is already doubled by the layout algorithm
                      // So we use it as-is and split it between image and description
                      const containerWidth = toPoints(photoBox.width);
                      const imageWidth = isLeftRight
                        ? toPoints(photoBox.width) / 2
                        : toPoints(photoBox.width);

                      // Use absolute positioning for everything (no flex for left/right)
                      const containerStyle = [
                        styles.photoContainer,
                        {
                          left: toPoints(photoBox.x),
                          top: toPoints(photoBox.y),
                          width: containerWidth,
                          height: toPoints(photoBox.height),
                        },
                      ];

                      return (
                        <View key={photoBox.asset.id} style={containerStyle}>
                          {/* Description on left - absolutely positioned */}
                          {hasDescription && descPosition === "left" && (
                            <View
                              style={[
                                styles.descriptionLeft,
                                {
                                  position: "absolute",
                                  left: 0,
                                  top: 0,
                                  width: imageWidth,
                                  height: toPoints(photoBox.height),
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: "black",
                                  fontSize: 14,
                                  fontFamily: "Roboto",
                                }}
                              >
                                {photoBox.asset.exifInfo.description}
                              </Text>
                            </View>
                          )}

                          {/* Image - absolutely positioned */}
                          <Image
                            src={imageUrl}
                            style={
                              isLeftRight
                                ? {
                                    position: "absolute",
                                    left:
                                      descPosition === "left" ? imageWidth : 0,
                                    top: 0,
                                    width: imageWidth,
                                    height: toPoints(photoBox.height),
                                    objectFit: "cover",
                                  }
                                : styles.photo
                            }
                          />

                          {/* Description on right - absolutely positioned */}
                          {hasDescription && descPosition === "right" && (
                            <View
                              style={[
                                styles.descriptionRight,
                                {
                                  position: "absolute",
                                  right: 0,
                                  top: 0,
                                  width: imageWidth,
                                  height: toPoints(photoBox.height),
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: "black",
                                  fontSize: 14,
                                  fontFamily: "Roboto",
                                }}
                              >
                                {photoBox.asset.exifInfo.description}
                              </Text>
                            </View>
                          )}

                          {/* Date - absolutely positioned */}
                          {showDates && photoBox.asset.fileCreatedAt && (
                            <View
                              style={(() => {
                                switch (descPosition) {
                                  case "bottom":
                                    return styles.dateOverlayTopRight;
                                  case "top":
                                    return styles.dateOverlayBottomRight;
                                  case "left":
                                    return {
                                      position: "absolute",
                                      top: 16,
                                      left: 8,
                                    };
                                  case "right":
                                    return {
                                      position: "absolute",
                                      top: 16,
                                      left: imageWidth + 8,
                                    };
                                  default:
                                    return styles.dateOverlayTopRight;
                                }
                              })()}
                            >
                              <Text
                                style={{
                                  color:
                                    descPosition === "left" ||
                                    descPosition === "right"
                                      ? "black"
                                      : "white",
                                  fontSize: 12,
                                  fontFamily: "Roboto",
                                }}
                              >
                                {new Date(
                                  photoBox.asset.fileCreatedAt,
                                ).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </Text>
                            </View>
                          )}

                          {/* Description for top/bottom positions */}
                          {hasDescription &&
                            (descPosition === "top" ||
                              descPosition === "bottom") && (
                              <Text
                                style={
                                  descPosition === "top"
                                    ? styles.descriptionTop
                                    : styles.descriptionBottom
                                }
                              >
                                {photoBox.asset.exifInfo.description}
                              </Text>
                            )}
                        </View>
                      );
                    })}
                  </Page>
                );
              })}
            </Document>
          </PDFViewer>
        </div>
      ) : (
        /* Live Preview */
        <div className="space-y-8 pb-8 overflow-x-auto px-4 sm:px-0">
          {pages.map((page) => {
            // Scale down to match PDF dimensions (72 DPI from 300 DPI)
            const displayWidth = toPoints(page.width);
            const displayHeight = toPoints(page.height);

            // Calculate page numbers for display
            let pageLabel: string;
            if (combinePages) {
              const leftPageNum = page.pageNumber * 2 - 1;
              const rightPageNum = page.pageNumber * 2;

              // Check if this combined page contains two logical pages or just one
              if (rightPageNum <= totalLogicalPages) {
                pageLabel = `Page ${leftPageNum}/${rightPageNum} of ${totalLogicalPages}`;
              } else {
                // Last page with odd number of logical pages
                pageLabel = `Page ${leftPageNum} of ${totalLogicalPages}`;
              }
            } else {
              pageLabel = `Page ${page.pageNumber} of ${totalLogicalPages}`;
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
                  className="relative bg-white shadow-lg mx-auto border border-gray-200"
                  style={{
                    width: `${displayWidth}px`,
                    height: `${displayHeight}px`,
                  }}
                >
                  {/* Page break indicator for combined pages */}
                  {combinePages && (
                    <div
                      className="absolute top-0 bottom-0 border-l border-dashed border-gray-300 z-10 pointer-events-none"
                      style={{ left: `${displayWidth / 2}px` }}
                    />
                  )}

                  {/* Photos */}
                  {page.photos.map((photoBox) => {
                    const imageUrl = `${immichConfig.baseUrl}/assets/${photoBox.asset.id}/thumbnail?size=preview&apiKey=${immichConfig.apiKey}`;
                    const isDragging =
                      aspectDragState?.assetId === photoBox.asset.id;

                    // Calculate current aspect ratio
                    const naturalWidth =
                      photoBox.asset.exifInfo?.exifImageWidth || 1;
                    const naturalHeight =
                      photoBox.asset.exifInfo?.exifImageHeight || 1;
                    let currentAspectRatio = naturalWidth / naturalHeight;
                    if (photoBox.asset.exifInfo?.orientation == "6") {
                      currentAspectRatio = naturalHeight / naturalWidth;
                    }
                    // Use custom aspect ratio if set
                    const aspectRatio =
                      customAspectRatios.get(photoBox.asset.id) ||
                      currentAspectRatio;
                    const isCustomized = customAspectRatios.has(
                      photoBox.asset.id,
                    );

                    // Find global index in filtered assets for drag & drop
                    const globalIndex = filteredAssets.findIndex(
                      (a) => a.id === photoBox.asset.id,
                    );
                    const isBeingDragged =
                      reorderDragState?.draggedAssetId === photoBox.asset.id;
                    const isDropTarget = dropTargetIndex === globalIndex;

                    // Check if this asset has been reordered (compare to default filtered order)
                    const defaultIndex = defaultFilteredAssets.findIndex(
                      (a) => a.id === photoBox.asset.id,
                    );
                    const isReordered =
                      customOrdering !== null && globalIndex !== defaultIndex;

                    const descPosition =
                      descriptionPositions.get(photoBox.asset.id) || "bottom";
                    const hasDescription =
                      showDescriptions &&
                      !!photoBox.asset.exifInfo?.description;
                    const isLeftRight =
                      hasDescription &&
                      (descPosition === "left" || descPosition === "right");

                    // When description is on left/right, photoBox.width is already doubled by the layout algorithm
                    // So we use it as-is and split it between image and description
                    const containerWidth = toPoints(photoBox.width);
                    const imageWidth = isLeftRight
                      ? toPoints(photoBox.width) / 2
                      : toPoints(photoBox.width);

                    return (
                      <div
                        key={photoBox.asset.id}
                        className={`absolute overflow-hidden group cursor-move ${isBeingDragged ? "opacity-50" : ""} ${isLeftRight ? "flex" : ""}`}
                        style={{
                          left: `${toPoints(photoBox.x)}px`,
                          top: `${toPoints(photoBox.y)}px`,
                          width: `${containerWidth}px`,
                          height: `${toPoints(photoBox.height)}px`,
                          flexDirection: "row",
                        }}
                        draggable
                        onDragStart={(e) =>
                          handleReorderDragStart(
                            photoBox.asset.id,
                            globalIndex,
                            e,
                          )
                        }
                        onDragOver={(e) =>
                          handleReorderDragOver(globalIndex, e)
                        }
                        onDragEnd={handleReorderDragEnd}
                        onDrop={(e) => handleReorderDrop(globalIndex, e)}
                      >
                        {/* Drop indicator - shown on left edge when hovering during drag */}
                        {isDropTarget && reorderDragState && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 shadow-lg z-10" />
                        )}

                        {/* Description on left (when position is 'left') */}
                        {hasDescription && descPosition === "left" && (
                          <div
                            className="text-black text-sm p-2 cursor-pointer bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center"
                            style={{ width: `${imageWidth}px`, flexShrink: 0 }}
                            onClick={(e) =>
                              handleDescriptionClick(photoBox.asset.id, e)
                            }
                            title="Click to change position"
                          >
                            {photoBox.asset.exifInfo.description}
                          </div>
                        )}

                        <img
                          src={imageUrl}
                          alt={photoBox.asset.originalFileName}
                          className="object-cover w-full h-full"
                          style={
                            isLeftRight
                              ? { width: `${imageWidth}px`, flexShrink: 0 }
                              : undefined
                          }
                          loading="lazy"
                        />
                        {showDates &&
                          photoBox.asset.fileCreatedAt &&
                          (() => {
                            const getDateConfig = () => {
                              switch (descPosition) {
                                case "bottom":
                                  return {
                                    className:
                                      "absolute top-2 right-2 p-2 bg-black/50 text-white text-xs rounded backdrop-blur-sm",
                                    style: {},
                                  };
                                case "top":
                                  return {
                                    className:
                                      "absolute bottom-2 right-2 p-2 bg-black/50 text-white text-xs rounded backdrop-blur-sm",
                                    style: {},
                                  };
                                case "left":
                                  return {
                                    className:
                                      "absolute top-4 left-2 text-black text-xs",
                                    style: {},
                                  };
                                case "right":
                                  return {
                                    className:
                                      "absolute top-4 text-black text-xs",
                                    style: { left: `${imageWidth + 8}px` },
                                  };
                                default:
                                  return {
                                    className:
                                      "absolute top-2 right-2 p-2 bg-black/50 text-white text-xs rounded backdrop-blur-sm",
                                    style: {},
                                  };
                              }
                            };
                            const config = getDateConfig();
                            return (
                              <div
                                className={config.className}
                                style={config.style}
                              >
                                {new Date(
                                  photoBox.asset.fileCreatedAt,
                                ).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </div>
                            );
                          })()}
                        {showDescriptions &&
                          photoBox.asset.exifInfo?.description &&
                          (() => {
                            const descPosition =
                              descriptionPositions.get(photoBox.asset.id) ||
                              "bottom";
                            const description =
                              photoBox.asset.exifInfo.description;

                            if (
                              descPosition === "left" ||
                              descPosition === "right"
                            ) {
                              // For left/right: description is next to image, not overlaid
                              return null;
                            }

                            const getDescriptionConfig = () => {
                              switch (descPosition) {
                                case "top":
                                  return {
                                    className:
                                      "absolute top-0 left-0 right-0 bg-black/50 text-white text-sm p-2 cursor-pointer hover:bg-black/70 transition-colors z-10",
                                    style: {},
                                  };
                                case "bottom":
                                default:
                                  return {
                                    className:
                                      "absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm p-2 cursor-pointer hover:bg-black/70 transition-colors z-10",
                                    style: {},
                                  };
                              }
                            };

                            const config = getDescriptionConfig();

                            return (
                              <div
                                className={config.className}
                                style={config.style}
                                onClick={(e) =>
                                  handleDescriptionClick(photoBox.asset.id, e)
                                }
                                title="Click to change position"
                              >
                                {description}
                              </div>
                            );
                          })()}

                        {/* Description on right (when position is 'right') */}
                        {hasDescription && descPosition === "right" && (
                          <div
                            className="text-black text-sm p-2 cursor-pointer bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center"
                            style={{ width: `${imageWidth}px`, flexShrink: 0 }}
                            onClick={(e) =>
                              handleDescriptionClick(photoBox.asset.id, e)
                            }
                            title="Click to change position"
                          >
                            {photoBox.asset.exifInfo.description}
                          </div>
                        )}

                        {/* Customization indicators */}
                        {isCustomized && (
                          <div
                            className="absolute top-2 left-2 w-2 h-2 bg-blue-500 rounded-full shadow-lg"
                            title="Aspect ratio customized"
                          />
                        )}
                        {isReordered && (
                          <div
                            className="absolute top-2 left-5 w-2 h-2 bg-green-500 rounded-full shadow-lg"
                            title="Image reordered"
                          />
                        )}

                        {/* Reset button - shown on hover for customized images */}
                        {isCustomized && (
                          <div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded shadow-lg text-xs font-medium"
                            onClick={(e) =>
                              handleResetAspectRatio(photoBox.asset.id, e)
                            }
                            title="Reset aspect ratio"
                          >
                            Reset
                          </div>
                        )}

                        {/* Left drag handle */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize transition-colors ${
                            isDragging && aspectDragState.edge === "left"
                              ? "bg-blue-500"
                              : "bg-transparent group-hover:bg-blue-400/50"
                          }`}
                          onMouseDown={(e) =>
                            handleAspectDragStart(
                              photoBox.asset.id,
                              "left",
                              aspectRatio,
                              photoBox.x,
                              photoBox.width,
                              e,
                            )
                          }
                        />

                        {/* Right drag handle */}
                        <div
                          className={`absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize transition-colors ${
                            isDragging && aspectDragState.edge === "right"
                              ? "bg-blue-500"
                              : "bg-transparent group-hover:bg-blue-400/50"
                          }`}
                          onMouseDown={(e) =>
                            handleAspectDragStart(
                              photoBox.asset.id,
                              "right",
                              aspectRatio,
                              photoBox.x,
                              photoBox.width,
                              e,
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PhotoGrid;
