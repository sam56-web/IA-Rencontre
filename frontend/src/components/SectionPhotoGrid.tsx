import { useRef, ChangeEvent } from 'react';
import { getUploadUrl, SectionPhoto } from '../services/api';

interface SectionPhotoGridProps {
  section: string;
  photos: SectionPhoto[];
  maxPhotos: number;
  onUpload: (file: File) => void;
  onDelete: (photoId: string) => void;
  isUploading: boolean;
  disabled?: boolean;
}

export function SectionPhotoGrid({
  photos,
  maxPhotos,
  onUpload,
  onDelete,
  isUploading,
  disabled = false,
}: SectionPhotoGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canAddMore = photos.length < maxPhotos && !disabled;

  // Don't render if maxPhotos is 0 (e.g., for not_looking_for section)
  if (maxPhotos === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">Photos</span>
        <span className="text-xs text-gray-400">
          {photos.length}/{maxPhotos}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="grid grid-cols-4 gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative aspect-square group">
            <img
              src={getUploadUrl(photo.url)}
              alt=""
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <button
                onClick={() => onDelete(photo.id)}
                className="p-1.5 bg-white rounded-full text-red-600 hover:bg-red-50"
                title="Supprimer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {canAddMore && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        )}

        {/* Empty slots to maintain grid */}
        {Array.from({ length: Math.max(0, maxPhotos - photos.length - (canAddMore ? 1 : 0)) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="aspect-square border border-gray-100 rounded-lg bg-gray-50"
          />
        ))}
      </div>
    </div>
  );
}
