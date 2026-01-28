import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { useCreateProfile } from '../../hooks/useProfile';

const PROMPTS = {
  currentLife: {
    title: 'Ma vie en ce moment',
    prompt: 'Décrivez votre quotidien, vos passions, ce qui vous anime. Que faites-vous de vos journées ? Qu\'est-ce qui vous rend unique ?',
    placeholder: 'Je suis... En ce moment dans ma vie... Ce qui me passionne...',
    minLength: 20,
    maxLength: 1500,
  },
  lookingFor: {
    title: 'Ce que je cherche',
    prompt: 'Décrivez le type de connexion que vous recherchez et les qualités que vous appréciez chez les autres.',
    placeholder: 'Je cherche... J\'aimerais rencontrer quelqu\'un qui...',
    minLength: 20,
    maxLength: 800,
  },
  whatsImportant: {
    title: 'Ce qui compte pour moi',
    prompt: 'Parlez de vos valeurs, de ce qui est non-négociable pour vous dans une relation.',
    placeholder: 'Pour moi, il est important de... Je valorise...',
    minLength: 20,
    maxLength: 800,
  },
  notLookingFor: {
    title: 'Ce que je ne cherche pas (optionnel)',
    prompt: 'Si vous souhaitez préciser ce que vous ne recherchez pas, c\'est ici.',
    placeholder: 'Je ne cherche pas... Merci de ne pas me contacter si...',
    minLength: 0,
    maxLength: 500,
  },
};

export function CreateProfilePage() {
  const navigate = useNavigate();
  const createProfile = useCreateProfile();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    currentLife: '',
    lookingFor: '',
    whatsImportant: '',
    notLookingFor: '',
  });

  const steps = ['currentLife', 'lookingFor', 'whatsImportant', 'notLookingFor'] as const;
  const currentStep = steps[step];
  const currentPrompt = PROMPTS[currentStep];

  const canProceed = () => {
    const value = formData[currentStep];
    return value.length >= currentPrompt.minLength;
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    createProfile.mutate(
      {
        currentLife: formData.currentLife,
        lookingFor: formData.lookingFor,
        whatsImportant: formData.whatsImportant,
        notLookingFor: formData.notLookingFor || undefined,
      },
      {
        onSuccess: () => {
          navigate('/discover');
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-warm-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Étape {step + 1} sur {steps.length}</span>
            <span>{Math.round(((step + 1) / steps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {currentPrompt.title}
          </h1>
          <p className="text-gray-600 mb-6">{currentPrompt.prompt}</p>

          <Textarea
            value={formData[currentStep]}
            onChange={(e) =>
              setFormData({ ...formData, [currentStep]: e.target.value })
            }
            placeholder={currentPrompt.placeholder}
            rows={8}
            showCount
            maxLength={currentPrompt.maxLength}
            className="mb-6"
          />

          {formData[currentStep].length < currentPrompt.minLength && currentPrompt.minLength > 0 && (
            <p className="text-sm text-amber-600 mb-4">
              Minimum {currentPrompt.minLength} caractères requis
              ({formData[currentStep].length}/{currentPrompt.minLength})
            </p>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              Précédent
            </Button>

            <Button
              onClick={handleNext}
              disabled={!canProceed() && currentPrompt.minLength > 0}
              isLoading={createProfile.isPending}
            >
              {step === steps.length - 1 ? 'Terminer' : 'Suivant'}
            </Button>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 bg-white/60 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Conseils pour un bon profil</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Soyez authentique et spécifique</li>
            <li>• Évitez les généralités ("j'aime voyager")</li>
            <li>• Donnez des exemples concrets</li>
            <li>• Écrivez comme si vous parliez à un ami</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
