import { useState, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent } from '../../components/ui/Card';
import { useMyProfile, useUpdateProfile } from '../../hooks/useProfile';
import { photosApi, SectionPhotoType, getUploadUrl } from '../../services/api';

const SECTION_CONFIG = {
  currentLife: {
    title: 'Ma vie en ce moment',
    key: 'current_life' as SectionPhotoType,
    photoKey: 'currentLife' as const,
    minLength: 20,
    maxLength: 1500,
  },
  lookingFor: {
    title: 'Ce que je cherche',
    key: 'looking_for' as SectionPhotoType,
    photoKey: 'lookingFor' as const,
    minLength: 20,
    maxLength: 800,
  },
  whatsImportant: {
    title: 'Ce qui compte pour moi',
    key: 'important' as SectionPhotoType,
    photoKey: 'important' as const,
    minLength: 20,
    maxLength: 800,
  },
  notLookingFor: {
    title: 'Ce que je ne cherche pas (optionnel)',
    key: 'not_looking_for' as SectionPhotoType,
    photoKey: 'notLookingFor' as const,
    minLength: 0,
    maxLength: 500,
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

  const [sectionPhotos, setSectionPhotos] = useState<Record<string, string | undefined>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize form when profile loads
  if (profile && !initialized) {
    setFormData({
      currentLife: profile.currentLife || '',
      lookingFor: profile.lookingFor || '',
      whatsImportant: profile.whatsImportant || '',
      notLookingFor: profile.notLookingFor || '',
    });
    setSectionPhotos({
      currentLife: profile.sectionPhotos?.currentLife,
      lookingFor: profile.sectionPhotos?.lookingFor,
      important: profile.sectionPhotos?.important,
      notLookingFor: profile.sectionPhotos?.notLookingFor,
    });
    setInitialized(true);
  }

  const uploadSectionPhoto = useMutation({
    mutationFn: ({ section, file }: { section: SectionPhotoType; file: File }) =>
      photosApi.uploadSectionPhoto(section, file),
    onSuccess: (data, variables) => {
      // Map the section key to the photo key
      const photoKey = Object.values(SECTION_CONFIG).find(c => c.key === variables.section)?.photoKey;
      if (photoKey) {
        setSectionPhotos(prev => ({ ...prev, [photoKey]: data.url }));
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const deleteSectionPhoto = useMutation({
    mutationFn: (section: SectionPhotoType) => photosApi.deleteSectionPhoto(section),
    onSuccess: (_, section) => {
      const photoKey = Object.values(SECTION_CONFIG).find(c => c.key === section)?.photoKey;
      if (photoKey) {
        setSectionPhotos(prev => ({ ...prev, [photoKey]: undefined }));
      }
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
          <p className="text-gray-600">Vous devez d'abord créer un profil</p>
          <Button className="mt-4" onClick={() => navigate('/profile/create')}>
            Créer mon profil
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
                photoUrl={getUploadUrl(sectionPhotos[config.photoKey])}
                onPhotoUpload={(file) => uploadSectionPhoto.mutate({ section: config.key, file })}
                onPhotoDelete={() => deleteSectionPhoto.mutate(config.key)}
                isUploading={uploadSectionPhoto.isPending}
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
  photoUrl?: string;
  onPhotoUpload: (file: File) => void;
  onPhotoDelete: () => void;
  isUploading: boolean;
}

function SectionEditor({
  title,
  value,
  onChange,
  minLength,
  maxLength,
  photoUrl,
  onPhotoUpload,
  onPhotoDelete,
  isUploading,
}: SectionEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onPhotoUpload(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {title}
        </h3>

        <div className="flex gap-4">
          {/* Photo section */}
          <div className="flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {photoUrl ? (
              <div className="relative group">
                <img
                  src={photoUrl}
                  alt=""
                  className="w-24 h-24 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 bg-white rounded-full text-gray-700 hover:bg-gray-100"
                    title="Changer la photo"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={onPhotoDelete}
                    className="p-1.5 bg-white rounded-full text-red-600 hover:bg-red-50"
                    title="Supprimer la photo"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs mt-1">Photo</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Text section */}
          <div className="flex-1">
            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={5}
              showCount
              maxLength={maxLength}
            />
            {value.length < minLength && minLength > 0 && (
              <p className="text-sm text-amber-600 mt-2">
                Minimum {minLength} caractères requis ({value.length}/{minLength})
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
