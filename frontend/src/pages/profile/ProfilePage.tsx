import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Textarea';
import { Card, CardContent } from '../../components/ui/Card';
import { useProfile } from '../../hooks/useProfile';
import { useStartConversation } from '../../hooks/useConversations';
import { useAuthStore } from '../../stores/auth.store';
import { INTENTION_LABELS } from '../../types';
import { getUploadUrl } from '../../services/api';

export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedQuote, setSelectedQuote] = useState('');

  const isOwnProfile = !userId || userId === currentUser?.id;
  const profileUserId = isOwnProfile ? currentUser?.id : userId;

  const { data: profile, isLoading } = useProfile(profileUserId || '');
  const startConversation = useStartConversation();

  const handleSendMessage = () => {
    if (!profile || !message.trim()) return;

    startConversation.mutate(
      {
        recipientId: profile.userId,
        content: message,
        quotedProfileText: selectedQuote || undefined,
      },
      {
        onSuccess: (data) => {
          setShowWriteModal(false);
          navigate(`/messages/${data.conversation.id}`);
        },
      }
    );
  };

  const handleQuoteSelect = (text: string) => {
    setSelectedQuote(text);
    setShowWriteModal(true);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-64 bg-gray-100 rounded-xl" />
            <div className="h-32 bg-gray-100 rounded-xl" />
            <div className="h-32 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Profil non trouvé</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/discover')}>
            Retour à la découverte
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header with photos */}
        <div className="mb-6">
          {profile.photos && profile.photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden">
              {profile.photos.slice(0, 3).map((photo, i) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt=""
                  className={`w-full object-cover ${i === 0 ? 'h-64 col-span-2 row-span-2' : 'h-32'}`}
                />
              ))}
            </div>
          ) : (
            <div className="h-48 bg-warm-100 rounded-xl flex items-center justify-center">
              <span className="text-6xl text-warm-400">
                {profile.username[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* User info */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>
            <p className="text-gray-600">
              {profile.age && `${profile.age} ans • `}
              {profile.location.city
                ? `${profile.location.city}, ${profile.location.country}`
                : profile.location.country}
            </p>
          </div>
          {!isOwnProfile && (
            <Button onClick={() => setShowWriteModal(true)}>Écrire</Button>
          )}
          {isOwnProfile && (
            <Button variant="outline" onClick={() => navigate('/profile/edit')}>
              Modifier
            </Button>
          )}
        </div>

        {/* Intentions */}
        <div className="flex flex-wrap gap-2 mb-6">
          {profile.intentions.map((intention) => (
            <span
              key={intention}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                profile.matchedIntentions.includes(intention)
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {INTENTION_LABELS[intention]}
            </span>
          ))}
        </div>

        {/* Profile text blocks */}
        <div className="space-y-6">
          <ProfileBlock
            title="Ma vie en ce moment"
            content={profile.currentLife}
            photoUrl={getUploadUrl(profile.sectionPhotos?.currentLife)}
            onQuoteSelect={!isOwnProfile ? handleQuoteSelect : undefined}
          />

          <ProfileBlock
            title="Ce que je cherche"
            content={profile.lookingFor}
            photoUrl={getUploadUrl(profile.sectionPhotos?.lookingFor)}
            onQuoteSelect={!isOwnProfile ? handleQuoteSelect : undefined}
          />

          <ProfileBlock
            title="Ce qui compte pour moi"
            content={profile.whatsImportant}
            photoUrl={getUploadUrl(profile.sectionPhotos?.important)}
            onQuoteSelect={!isOwnProfile ? handleQuoteSelect : undefined}
          />

          {profile.notLookingFor && (
            <ProfileBlock
              title="Ce que je ne cherche pas"
              content={profile.notLookingFor}
              photoUrl={getUploadUrl(profile.sectionPhotos?.notLookingFor)}
              variant="muted"
            />
          )}
        </div>

        {/* Themes */}
        {profile.themes && profile.themes.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Thèmes détectés</p>
            <div className="flex flex-wrap gap-2">
              {profile.themes.map((theme) => (
                <span
                  key={theme}
                  className="px-2 py-1 bg-warm-100 text-warm-700 rounded text-sm"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Write modal */}
        <Modal
          isOpen={showWriteModal}
          onClose={() => {
            setShowWriteModal(false);
            setSelectedQuote('');
          }}
          title={`Écrire à ${profile.username}`}
          size="lg"
        >
          <div className="space-y-4">
            {selectedQuote && (
              <div className="bg-warm-50 rounded-lg p-4 border-l-4 border-primary-500">
                <p className="text-sm text-gray-500 mb-1">En réponse à :</p>
                <p className="text-gray-700 font-serif italic">"{selectedQuote}"</p>
                <button
                  onClick={() => setSelectedQuote('')}
                  className="text-xs text-gray-500 hover:text-gray-700 mt-2"
                >
                  Retirer la citation
                </button>
              </div>
            )}

            <Textarea
              label="Votre message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Écrivez un message personnalisé qui montre que vous avez lu le profil..."
              rows={6}
              showCount
              maxLength={5000}
            />

            <p className="text-sm text-gray-500">
              Conseil : Référencez quelque chose de spécifique du profil pour montrer votre intérêt
              sincère.
            </p>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowWriteModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSendMessage}
                isLoading={startConversation.isPending}
                disabled={message.trim().length < 10}
              >
                Envoyer
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}

interface ProfileBlockProps {
  title: string;
  content: string;
  photoUrl?: string;
  variant?: 'default' | 'muted';
  onQuoteSelect?: (text: string) => void;
}

function ProfileBlock({ title, content, photoUrl, variant = 'default', onQuoteSelect }: ProfileBlockProps) {
  const handleTextSelect = () => {
    if (!onQuoteSelect) return;
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      onQuoteSelect(selection.toString().trim().slice(0, 200));
    }
  };

  return (
    <Card className={variant === 'muted' ? 'bg-gray-50' : ''}>
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {title}
        </h3>
        <div className={photoUrl ? 'flex gap-4' : ''}>
          {photoUrl && (
            <div className="flex-shrink-0">
              <img
                src={photoUrl}
                alt=""
                className="w-24 h-24 object-cover rounded-lg"
              />
            </div>
          )}
          <div className="flex-1">
            <p
              className="text-gray-800 font-serif leading-relaxed whitespace-pre-line"
              onMouseUp={handleTextSelect}
            >
              {content}
            </p>
            {onQuoteSelect && (
              <p className="text-xs text-gray-400 mt-3">
                Sélectionnez du texte pour le citer dans votre message
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
