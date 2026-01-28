const THEME_KEYWORDS: Record<string, string[]> = {
  voyage: ['voyage', 'voyager', 'aventure', 'explorer', 'découvrir', 'nomade', 'road-trip', 'backpack', 'travel'],
  musique: ['musique', 'concert', 'guitare', 'piano', 'chanter', 'festival', 'jazz', 'rock', 'classique', 'music'],
  écriture: ['écrire', 'écriture', 'livre', 'roman', 'poésie', 'auteur', 'rédiger', 'writer', 'writing'],
  art: ['art', 'peinture', 'dessin', 'créatif', 'exposition', 'musée', 'sculpture', 'artistic', 'creative'],
  nature: ['nature', 'randonnée', 'montagne', 'mer', 'forêt', 'camping', 'plein air', 'outdoor', 'hiking'],
  réflexion: ['philosophie', 'réflexion', 'discussion', 'débat', 'sens', 'penser', 'méditation', 'contemplation'],
  sport: ['sport', 'course', 'yoga', 'fitness', 'vélo', 'natation', 'tennis', 'football', 'running'],
  cuisine: ['cuisine', 'gastronomie', 'recette', 'restaurant', 'cuisinier', 'cooking', 'food', 'chef'],
  tech: ['technologie', 'informatique', 'programmation', 'startup', 'innovation', 'digital', 'coding', 'developer'],
  engagement: ['bénévolat', 'humanitaire', 'solidarité', 'cause', 'engagement', 'associatif', 'volunteer'],
  langues: ['langue', 'anglais', 'espagnol', 'polyglotte', 'apprendre', 'bilingue', 'multilingual'],
  cinéma: ['cinéma', 'film', 'série', 'documentaire', 'réalisateur', 'movies', 'cinema'],
  lecture: ['lire', 'lecture', 'livres', 'bibliothèque', 'littérature', 'reading', 'books'],
  photographie: ['photo', 'photographie', 'photographe', 'appareil', 'photography', 'camera'],
  jeux: ['jeux', 'gaming', 'jeu vidéo', 'board games', 'échecs', 'chess'],
  animaux: ['animaux', 'chien', 'chat', 'animaux de compagnie', 'pets', 'animals'],
};

const NEGATION_WORDS = ['pas', 'plus', 'jamais', 'sans', 'arrêté', 'fini', 'terminé', 'not', 'never', 'no longer'];
const NEGATION_WINDOW = 3; // Words to look before keyword

interface ThemeMatch {
  theme: string;
  count: number;
  negated: boolean;
}

export function extractThemes(text: string): string[] {
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const themeMatches: Map<string, ThemeMatch> = new Map();

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    let matchCount = 0;
    let negatedCount = 0;

    for (const keyword of keywords) {
      // Find all occurrences of keyword
      let searchIndex = 0;
      while (true) {
        const keywordIndex = normalizedText.indexOf(keyword, searchIndex);
        if (keywordIndex === -1) break;

        // Check for negation in the window before keyword
        const textBefore = normalizedText.slice(Math.max(0, keywordIndex - 30), keywordIndex);
        const isNegated = NEGATION_WORDS.some((neg) => textBefore.includes(neg));

        if (isNegated) {
          negatedCount++;
        } else {
          matchCount++;
        }

        searchIndex = keywordIndex + keyword.length;
      }
    }

    if (matchCount > negatedCount) {
      themeMatches.set(theme, {
        theme,
        count: matchCount - negatedCount,
        negated: false,
      });
    }
  }

  // Sort by count and take top 6
  const sortedThemes = Array.from(themeMatches.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((t) => t.theme);

  return sortedThemes;
}

export function calculateProfileCompleteness(
  currentLife: string,
  lookingFor: string,
  whatsImportant: string,
  notLookingFor: string | undefined,
  photoCount: number,
  user: { birthYear?: number; locationCity?: string; languages: string[]; intentions: string[] }
): number {
  let score = 0;

  // Text blocks (50 points max)
  score += Math.min(currentLife.length / 100, 15);
  score += Math.min(lookingFor.length / 60, 15);
  score += Math.min(whatsImportant.length / 60, 15);
  if (notLookingFor && notLookingFor.length > 10) score += 5;

  // Photos (25 points max)
  score += Math.min(photoCount * 6, 24);
  if (photoCount >= 2) score += 1;

  // User info (25 points max)
  if (user.birthYear) score += 5;
  if (user.locationCity) score += 5;
  if (user.languages.length > 1) score += 5;
  if (user.intentions.length > 1) score += 5;
  score += 5; // Base for having filled minimum

  return Math.min(Math.round(score), 100);
}
