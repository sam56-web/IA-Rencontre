import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent } from '../../components/ui/Card';
import { SectionPhotoGrid } from '../../components/SectionPhotoGrid';
import { useMyProfile, useUpdateProfile } from '../../hooks/useProfile';
import {
  photosApi,
  SectionPhotoType,
  SectionPhoto,
  SectionPhotosGrouped,
  SECTION_PHOTO_LIMITS,
  getUploadUrl
} from '../../services/api';
import type { Photo } from '../../types';

const SECTION_CONFIG = {
  currentLife: {
    title: 'Ma vie en ce moment',
    key: 'current_life' as SectionPhotoType,
    minLength: 20,
    maxLength: 1500,
    maxPhotos: SECTION_PHOTO_LIMITS.current_life,
  },
  lookingFor: {
    title: 'Ce que je cherche',
    key: 'looking_for' as SectionPhotoType,
    minLength: 20,
    maxLength: 800,
    maxPhotos: SECTION_PHOTO_LIMITS.looking_for,
  },
  whatsImportant: {
    title: 'Ce qui compte pour moi',
    key: 'important' as SectionPhotoType,
    minLength: 20,
    maxLength: 800,
    maxPhotos: SECTION_PHOTO_LIMITS.important,
  },
  notLookingFor: {
    title: 'Ce que je ne cherche pas (optionnel)',
    key: null, // No photos for this section
    minLength: 0,
    maxLength: 500,
    maxPhotos: 0,
  },
};

export function ProfileEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();

  const [formData, setFormData] = useState({
    currentLife: '',
    lookingFor: '',
    whatsImportant: '',
    notLookingFor: '',
  });

  const [sectionPhotos, setSectionPhotos] = useState<SectionPhotosGrouped>({
    current_life: [],
    looking_for: [],
    important: [],
  });
  const [initialized, setInitialized] = useState(false);
  const [uploadingSection, setUploadingSection] = useState<string | null>(null);

  // Fetch main profile photos
  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['photos', 'mine'],
    queryFn: photosApi.getMyPhotos,
  });

  // Fetch section photos
  const { data: fetchedSectionPhotos, refetch: refetchSectionPhotos } = useQuery({
    queryKey: ['photos', 'section'],
    queryFn: photosApi.getSectionPhotos,
  });

  // Initialize form when profile loads
  useEffect(() => {
    if (profile && !initialized) {
      setFormData({
        currentLife: profile.currentLife || '',
        lookingFor: profile.lookingFor || '',
        whatsImportant: profile.whatsImportant || '',
        notLookingFor: profile.notLookingFor || '',
      });
      setInitialized(true);
    }
  }, [profile, initialized]);

  // Update section photos when fetched
  useEffect(() => {
    if (fetchedSectionPhotos) {
      setSectionPhotos(fetchedSectionPhotos);
    }
  }, [fetchedSectionPhotos]);

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => photosApi.uploadPhoto(file),
    onSuccess: () => {
      refetchPhotos();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => photosApi.deletePhoto(photoId),
    onSuccess: () => {
      refetchPhotos();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const uploadSectionPhoto = useMutation({
    mutationFn: ({ section, file }: { section: SectionPhotoType; file: File }) =>
      photosApi.uploadSectionPhoto(section, file),
    onMutate: ({ section }) => {
      setUploadingSection(section);
    },
    onSuccess: (newPhoto, { section }) => {
      // Add the new photo to the local state
      setSectionPhotos(prev => ({
        ...prev,
        [section]: [...prev[section], newPhoto],
      }));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onSettled: () => {
      setUploadingSection(null);
    },
  });

  const deleteSectionPhoto = useMutation({
    mutationFn: (photoId: string) => photosApi.deleteSectionPhoto(photoId),
    onSuccess: (_, photoId) => {
      // Remove the photo from local state
      setSectionPhotos(prev => ({
        current_life: prev.current_life.filter(p => p.id !== photoId),
        looking_for: prev.looking_for.filter(p => p.id !== photoId),
        important: prev.important.filter(p => p.id !== photoId),
      }));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const handleSave = () => {
    updateProfile.mutate(formData, {
      onSuccess: () => {
        navigate('/profile');
      },
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-64 bg-gray-100 rounded-xl" />
            <div className="h-64 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Vous devez d'abord creer un profil</p>
          <Button className="mt-4" onClick={() => navigate('/profile/create')}>
            Creer mon profil
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Modifier mon profil</h1>
          <Button variant="outline" onClick={() => navigate('/profile')}>
            Annuler
          </Button>
        </div>

        {/* Main Photos Grid */}
        <PhotosGrid
          photos={photos}
          onUpload={(file) => uploadPhoto.mutate(file)}
          onDelete={(id) => deletePhoto.mutate(id)}
          isUploading={uploadPhoto.isPending}
          maxPhotos={6}
        />

        <div className="space-y-6">
          {(Object.entries(SECTION_CONFIG) as [keyof typeof SECTION_CONFIG, typeof SECTION_CONFIG[keyof typeof SECTION_CONFIG]][]).map(
            ([field, config]) => (
              <SectionEditor
                key={field}
                title={config.title}
                value={formData[field]}
                onChange={(value) => setFormData({ ...formData, [field]: value })}
                minLength={config.minLength}
                maxLength={config.maxLength}
                sectionKey={config.key}
                photos={config.key ? sectionPhotos[config.key] : []}
                maxPhotos={config.maxPhotos}
                onPhotoUpload={(file) => {
                  if (config.key) {
                    uploadSectionPhoto.mutate({ section: config.key, file });
                  }
                }}
                onPhotoDelete={(photoId) => deleteSectionPhoto.mutate(photoId)}
                isUploading={uploadingSection === config.key}
              />
            )
          )}
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/profile')}>
            Annuler
          </Button>
          <Button onClick={handleSave} isLoading={updateProfile.isPending}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Layout>
  );
}

interface SectionEditorProps {
  title: string;
  value: string;
  onChange: (value: string) => void;
  minLength: number;
  maxLength: number;
  sectionKey: SectionPhotoType | null;
  photos: SectionPhoto[];
  maxPhotos: number;
  onPhotoUpload: (file: File) => void;
  onPhotoDelete: (photoId: string) => void;
  isUploading: boolean;
}

function SectionEditor({
  title,
  value,
  onChange,
  minLength,
  maxLength,
  sectionKey,
  photos,
  maxPhotos,
  onPhotoUpload,
  onPhotoDelete,
  isUploading,
}: SectionEditorProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {title}
          </h3>
          {maxPhotos > 0 && (
            <span className="text-xs text-gray-400">
              {photos.length}/{maxPhotos} photos
            </span>
          )}
        </div>

        {/* Text section */}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          showCount
          maxLength={maxLength}
        />
        {value.length < minLength && minLength > 0 && (
          <p className="text-sm text-amber-600 mt-2">
            Minimum {minLength} caracteres requis ({value.length}/{minLength})
          </p>
        )}

        {/* Section photos grid - only show if maxPhotos > 0 */}
        {sectionKey && maxPhotos > 0 && (
          <SectionPhotoGrid
            section={sectionKey}
            photos={photos}
            maxPhotos={maxPhotos}
            onUpload={onPhotoUpload}
            onDelete={onPhotoDelete}
            isUploading={isUploading}
          />
        )}
      </CardContent>
    </Card>
  );
}

// Photos Grid Component for main profile photos
interface PhotosGridProps {
  photos: Photo[];
  onUpload: (file: File) => void;
  onDelete: (photoId: string) => void;
  isUploading: boolean;
  maxPhotos: number;
}

function PhotosGrid({ photos, onUpload, onDelete, isUploading, maxPhotos }: PhotosGridProps) {
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

  const canAddMore = photos.length < maxPhotos;

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Mes photos
          </h3>
          <span className="text-sm text-gray-400">
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

        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative aspect-square group">
              <img
                src={getUploadUrl(photo.url)}
                alt=""
                className="w-full h-full object-cover rounded-lg"
              />
              {index === 0 && (
                <span className="absolute top-2 left-2 bg-primary-500 text-white text-xs px-2 py-0.5 rounded">
                  Principale
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <button
                  onClick={() => onDelete(photo.id)}
                  className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50"
                  title="Supprimer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm mt-1">Ajouter</span>
                </>
              )}
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          La premiere photo sera votre photo principale. Formats acceptes: JPG, PNG, WebP (max 5 Mo)
        </p>
      </CardContent>
    </Card>
  );
}
