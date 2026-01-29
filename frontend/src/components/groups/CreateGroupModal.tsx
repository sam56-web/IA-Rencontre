import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { groupsApi, themesApi } from '../../services/api';
import type { Group } from '../../types';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (group: Group) => void;
}

export function CreateGroupModal({ isOpen, onClose, onSuccess }: CreateGroupModalProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [themeId, setThemeId] = useState<string>('');
  const [isPublic, setIsPublic] = useState(false);

  const { data: themes } = useQuery({
    queryKey: ['themes'],
    queryFn: themesApi.getAllThemes,
    enabled: isOpen,
  });

  const createGroup = useMutation({
    mutationFn: () =>
      groupsApi.createGroup({
        name,
        description: description || undefined,
        themeId: themeId || undefined,
        isPublic,
      }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      resetForm();
      onSuccess(group);
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setThemeId('');
    setIsPublic(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length >= 3) {
      createGroup.mutate();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Creer un groupe" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nom du groupe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: Club de lecture parisien"
          required
          minLength={3}
          maxLength={100}
        />

        <Textarea
          label="Description (optionnelle)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Decrivez votre groupe en quelques mots..."
          rows={3}
          maxLength={500}
          showCount
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thematique (optionnelle)
          </label>
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Aucune thematique</option>
            {themes?.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
          <div>
            <span className="text-sm font-medium text-gray-700">Groupe public</span>
            <p className="text-xs text-gray-500">
              {isPublic
                ? 'Tout le monde peut rejoindre ce groupe'
                : 'Seules les personnes invitees peuvent rejoindre'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            isLoading={createGroup.isPending}
            disabled={name.trim().length < 3}
          >
            Creer le groupe
          </Button>
        </div>
      </form>
    </Modal>
  );
}
