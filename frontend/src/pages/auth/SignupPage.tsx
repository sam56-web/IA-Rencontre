import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { INTENTIONS, INTENTION_LABELS } from '../../types';
import type { Intention } from '../../types';

export function SignupPage() {
  const { signup, isSigningUp, signupError } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    locationCountry: 'France',
    locationCity: '',
    intentions: [] as Intention[],
    birthYear: '',
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
    } else {
      signup({
        ...formData,
        birthYear: formData.birthYear ? parseInt(formData.birthYear) : undefined,
      });
    }
  };

  const toggleIntention = (intention: Intention) => {
    setFormData((prev) => ({
      ...prev,
      intentions: prev.intentions.includes(intention)
        ? prev.intentions.filter((i) => i !== intention)
        : [...prev.intentions, intention],
    }));
  };

  const error = signupError as Error | null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-warm-50 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <span className="text-white font-bold text-3xl">A</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">AI Connect</h1>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Créer un compte</h2>
          <p className="text-gray-600 mb-6">Étape {step} sur 2</p>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 ? (
              <>
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="vous@example.com"
                  required
                />

                <Input
                  label="Nom d'utilisateur"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="votre_pseudo"
                  helperText="3-30 caractères, lettres, chiffres, _ et -"
                  required
                />

                <Input
                  label="Mot de passe"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  helperText="Minimum 8 caractères avec majuscule, minuscule et chiffre"
                  required
                />

                <Button type="submit" className="w-full" size="lg">
                  Continuer
                </Button>
              </>
            ) : (
              <>
                <Input
                  label="Pays"
                  value={formData.locationCountry}
                  onChange={(e) => setFormData({ ...formData, locationCountry: e.target.value })}
                  placeholder="France"
                  required
                />

                <Input
                  label="Ville (optionnel)"
                  value={formData.locationCity}
                  onChange={(e) => setFormData({ ...formData, locationCity: e.target.value })}
                  placeholder="Paris"
                />

                <Input
                  label="Année de naissance (optionnel)"
                  type="number"
                  value={formData.birthYear}
                  onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                  placeholder="1990"
                  min="1900"
                  max={new Date().getFullYear() - 18}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Que cherchez-vous ? (au moins 1)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {INTENTIONS.map((intention) => (
                      <button
                        key={intention}
                        type="button"
                        onClick={() => toggleIntention(intention)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          formData.intentions.includes(intention)
                            ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                            : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {INTENTION_LABELS[intention]}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error.message || 'Une erreur est survenue'}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    Retour
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    isLoading={isSigningUp}
                    disabled={formData.intentions.length === 0}
                  >
                    Créer mon compte
                  </Button>
                </div>
              </>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Déjà un compte ?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
