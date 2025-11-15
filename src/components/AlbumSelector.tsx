import { useState, useEffect } from "react";
import { getAllAlbums, type AlbumResponseDto } from "@immich/sdk";
import type { ImmichConfig } from "./ConnectionForm";

interface AlbumSelectorProps {
  immichConfig: ImmichConfig;
  onSelectAlbum: (album: AlbumResponseDto) => void;
}

function AlbumSelector({ immichConfig, onSelectAlbum }: AlbumSelectorProps) {
  const [albums, setAlbums] = useState<AlbumResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlbums();
  }, []);

  const loadAlbums = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch both owned and shared albums concurrently
      const [ownedAlbums, sharedAlbums] = await Promise.all([
        getAllAlbums({}),
        getAllAlbums({ shared: true }),
      ]);

      // Combine and deduplicate by album ID
      const allAlbums = [...ownedAlbums];
      const ownedIds = new Set(ownedAlbums.map((a) => a.id));

      for (const album of sharedAlbums) {
        if (!ownedIds.has(album.id)) {
          allAlbums.push(album);
        }
      }
      console.log(allAlbums);

      // Sort by most recent asset
      allAlbums.sort((a, b) => {
        if (!a.endDate) {
          return -1;
        }
        if (!b.endDate) {
          return 1;
        }
        return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
      });

      setAlbums(allAlbums);
    } catch (err) {
      setError((err as Error).message || "Failed to load albums");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-4 text-gray-600">Loading albums...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={loadAlbums}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm transition-colors shadow-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <p className="text-gray-600">No albums found in your Immich library.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Select an Album</h2>
        <p className="text-gray-600 mt-1">
          Choose an album to create a photo book ({albums.length} albums found)
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {albums.map((album) => (
          <button
            key={album.id}
            onClick={() => onSelectAlbum(album)}
            className="text-left bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
          >
            {album.albumThumbnailAssetId ? (
              <div className="aspect-video bg-gray-200 relative overflow-hidden">
                <img
                  src={`${immichConfig.baseUrl}/assets/${album.albumThumbnailAssetId}/thumbnail?size=preview&apiKey=${immichConfig.apiKey}`}
                  alt={album.albumName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="aspect-video bg-gray-200 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 truncate">
                {album.albumName}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {album.assetCount} {album.assetCount === 1 ? "photo" : "photos"}
              </p>
              {album.description && (
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                  {album.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default AlbumSelector;
