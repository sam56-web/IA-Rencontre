import { query, getClient } from './pool.js';
import { hashPassword } from '../utils/password.js';

/**
 * IMPORTANT: Ce seed est IDEMPOTENT
 * - Il peut être lancé plusieurs fois sans casser les données
 * - Utilise ON CONFLICT DO NOTHING pour éviter les doublons
 * - NE supprime JAMAIS les données existantes
 */
async function seed(): Promise<void> {
  console.log('Starting database seeding (idempotent)...');

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Create test users
    const password = await hashPassword('Test1234!');

    const users = [
      {
        email: 'alice@example.com',
        username: 'alice_writer',
        locationCountry: 'France',
        locationCity: 'Paris',
        intentions: ['romantic', 'discussions'],
        birthYear: 1990,
        currentLife: `Je suis rédactrice freelance, passionnée par les mots et les histoires. Mes journées se partagent entre l'écriture dans des cafés parisiens, la lecture insatiable et les promenades le long de la Seine. J'aime la solitude créative autant que les discussions profondes jusqu'au bout de la nuit.`,
        lookingFor: `Quelqu'un qui aime les discussions sans fin, qui peut débattre sans se fâcher, qui apprécie le silence partagé autant que les conversations. Un esprit curieux qui pose des questions plutôt que de juger.`,
        whatsImportant: `L'authenticité, l'humour, la curiosité intellectuelle. Je cherche quelqu'un qui a ses propres passions et qui respecte les miennes. La capacité à être présent, vraiment présent.`,
        notLookingFor: `Pas de conversations superficielles, pas de "salut ça va". Je préfère les gens qui osent être vulnérables.`,
      },
      {
        email: 'bob@example.com',
        username: 'bob_explorer',
        locationCountry: 'France',
        locationCity: 'Lyon',
        intentions: ['friendship', 'travel_experiences'],
        birthYear: 1985,
        currentLife: `Développeur le jour, musicien amateur la nuit. Je vis entre deux valises et deux guitares. Après 10 ans en startup, j'ai appris que la vie c'est aussi savoir décrocher. Je médite, je fais du yoga, je cuisine mal mais avec enthousiasme.`,
        lookingFor: `Des compagnons de voyage, physiques ou intellectuels. Des gens avec qui partager un café en terrasse ou une randonnée improvisée. Pas forcément de romance, mais de vraies connexions.`,
        whatsImportant: `La spontanéité, l'ouverture d'esprit, la capacité à rire de soi. Je valorise les gens qui ont des histoires à raconter et qui savent écouter celles des autres.`,
        notLookingFor: `Les plans rigides, les gens qui n'ont jamais le temps, les conversations qui tournent uniquement autour du travail.`,
      },
      {
        email: 'claire@example.com',
        username: 'claire_creative',
        locationCountry: 'France',
        locationCity: 'Paris',
        intentions: ['creative_project', 'discussions'],
        birthYear: 1992,
        currentLife: `Illustratrice et designer, je crée des univers visuels pour des marques et des auteurs. Mon atelier est un joyeux chaos de couleurs et de carnets de croquis. Je suis aussi bénévole dans une association qui enseigne l'art aux enfants défavorisés.`,
        lookingFor: `Des collaborateurs créatifs, des esprits qui veulent créer quelque chose ensemble. Que ce soit un zine, une expo, un podcast ou juste échanger des idées autour d'un projet.`,
        whatsImportant: `La créativité sans ego, la générosité dans le partage des idées, l'engagement pour des causes qui comptent. Je cherche des gens qui font plus que parler.`,
        notLookingFor: `Les profils "je veux créer une startup" sans substance. Les gens qui prennent plus qu'ils ne donnent.`,
      },
      {
        email: 'david@example.com',
        username: 'david_thinker',
        locationCountry: 'Belgique',
        locationCity: 'Bruxelles',
        intentions: ['romantic', 'friendship'],
        birthYear: 1988,
        currentLife: `Professeur de philosophie dans un lycée, je passe mes journées à poser des questions auxquelles personne n'a de réponse. Le week-end, je fais de la poterie (mal) et je lis des polars (beaucoup). Célibataire depuis un moment, je réapprends à m'ouvrir.`,
        lookingFor: `Une connexion authentique, quelqu'un avec qui la conversation ne s'épuise jamais. Pas de jeux, pas de masques. Amitié ou plus, je suis ouvert aux surprises de la vie.`,
        whatsImportant: `L'honnêteté, même quand c'est inconfortable. La capacité à réfléchir sur soi. L'humour comme antidote à la gravité du monde.`,
        notLookingFor: `Les relations de surface. Les gens qui fuient les sujets sérieux ou au contraire, ceux qui ne savent jamais être légers.`,
      },
      {
        email: 'emma@example.com',
        username: 'emma_nomad',
        locationCountry: 'France',
        locationCity: 'Marseille',
        intentions: ['travel_experiences', 'not_sure_yet'],
        birthYear: 1995,
        currentLife: `Digital nomad depuis 3 ans, je travaille en marketing depuis n'importe où avec du wifi. J'ai vécu à Bali, Lisbonne, et maintenant je pose mes valises quelques mois à Marseille. Je cherche à créer des racines tout en gardant ma liberté.`,
        lookingFor: `Des âmes voyageuses, physiquement ou mentalement. Des gens qui comprennent qu'on peut aimer bouger et quand même chercher des connexions profondes. Je ne sais pas encore ce que je cherche exactement, et c'est ok.`,
        whatsImportant: `L'adaptabilité, le non-jugement, la curiosité pour les différentes façons de vivre. J'apprécie les gens qui ont quitté leur zone de confort au moins une fois.`,
        notLookingFor: `Les gens ancrés qui jugent ceux qui bougent, ou à l'inverse, ceux qui fuient systématiquement l'engagement.`,
      },
    ];

    // Store user IDs for section photos
    const userIds: Record<string, string> = {};

    for (const user of users) {
      // Insert user with ON CONFLICT DO NOTHING (idempotent)
      const userResult = await client.query(
        `INSERT INTO users (
          email, username, password_hash, location_country, location_city,
          intentions, birth_year, open_to_remote, languages
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, ARRAY['fr', 'en'])
        ON CONFLICT (email) DO NOTHING
        RETURNING id`,
        [user.email, user.username, password, user.locationCountry, user.locationCity, user.intentions, user.birthYear]
      );

      // Get user ID (either from insert or existing)
      let userId: string;
      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        console.log(`  ✓ Created user: ${user.username}`);
      } else {
        // User already exists, get their ID
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [user.email]);
        userId = existingUser.rows[0].id;
        console.log(`  → User exists: ${user.username}`);
      }

      userIds[user.username] = userId;

      // Insert profile with ON CONFLICT DO NOTHING (idempotent)
      const profileResult = await client.query(
        `INSERT INTO profiles (
          user_id, current_life, looking_for, whats_important, not_looking_for,
          extracted_themes, completeness_score, moderation_status
        ) VALUES ($1, $2, $3, $4, $5, $6, 75, 'approved')
        ON CONFLICT (user_id) DO NOTHING
        RETURNING id`,
        [
          userId,
          user.currentLife,
          user.lookingFor,
          user.whatsImportant,
          user.notLookingFor,
          ['écriture', 'réflexion', 'voyage'],
        ]
      );

      if (profileResult.rows.length > 0) {
        console.log(`    ✓ Created profile for: ${user.username}`);
      } else {
        console.log(`    → Profile exists for: ${user.username}`);
      }
    }

    // Add section photos for test users (idempotent with ON CONFLICT)
    console.log('\nAdding section photos...');

    const sectionPhotos = [
      // Alice - current_life (3 photos)
      { username: 'alice_writer', section: 'current_life', url: 'https://picsum.photos/seed/alice-life1/400/400', position: 0 },
      { username: 'alice_writer', section: 'current_life', url: 'https://picsum.photos/seed/alice-life2/400/400', position: 1 },
      { username: 'alice_writer', section: 'current_life', url: 'https://picsum.photos/seed/alice-life3/400/400', position: 2 },
      // Alice - looking_for (2 photos)
      { username: 'alice_writer', section: 'looking_for', url: 'https://picsum.photos/seed/alice-look1/400/400', position: 0 },
      { username: 'alice_writer', section: 'looking_for', url: 'https://picsum.photos/seed/alice-look2/400/400', position: 1 },
      // Alice - important (1 photo)
      { username: 'alice_writer', section: 'important', url: 'https://picsum.photos/seed/alice-imp1/400/400', position: 0 },

      // Bob - current_life (2 photos)
      { username: 'bob_explorer', section: 'current_life', url: 'https://picsum.photos/seed/bob-life1/400/400', position: 0 },
      { username: 'bob_explorer', section: 'current_life', url: 'https://picsum.photos/seed/bob-life2/400/400', position: 1 },
      // Bob - looking_for (1 photo)
      { username: 'bob_explorer', section: 'looking_for', url: 'https://picsum.photos/seed/bob-look1/400/400', position: 0 },
      // Bob - important (2 photos)
      { username: 'bob_explorer', section: 'important', url: 'https://picsum.photos/seed/bob-imp1/400/400', position: 0 },
      { username: 'bob_explorer', section: 'important', url: 'https://picsum.photos/seed/bob-imp2/400/400', position: 1 },

      // Claire - current_life (4 photos - max)
      { username: 'claire_creative', section: 'current_life', url: 'https://picsum.photos/seed/claire-life1/400/400', position: 0 },
      { username: 'claire_creative', section: 'current_life', url: 'https://picsum.photos/seed/claire-life2/400/400', position: 1 },
      { username: 'claire_creative', section: 'current_life', url: 'https://picsum.photos/seed/claire-life3/400/400', position: 2 },
      { username: 'claire_creative', section: 'current_life', url: 'https://picsum.photos/seed/claire-life4/400/400', position: 3 },
      // Claire - looking_for (3 photos)
      { username: 'claire_creative', section: 'looking_for', url: 'https://picsum.photos/seed/claire-look1/400/400', position: 0 },
      { username: 'claire_creative', section: 'looking_for', url: 'https://picsum.photos/seed/claire-look2/400/400', position: 1 },
      { username: 'claire_creative', section: 'looking_for', url: 'https://picsum.photos/seed/claire-look3/400/400', position: 2 },
      // Claire - important (2 photos - max)
      { username: 'claire_creative', section: 'important', url: 'https://picsum.photos/seed/claire-imp1/400/400', position: 0 },
      { username: 'claire_creative', section: 'important', url: 'https://picsum.photos/seed/claire-imp2/400/400', position: 1 },

      // David - current_life (1 photo)
      { username: 'david_thinker', section: 'current_life', url: 'https://picsum.photos/seed/david-life1/400/400', position: 0 },
      // David - looking_for (1 photo)
      { username: 'david_thinker', section: 'looking_for', url: 'https://picsum.photos/seed/david-look1/400/400', position: 0 },

      // Emma - current_life (2 photos)
      { username: 'emma_nomad', section: 'current_life', url: 'https://picsum.photos/seed/emma-life1/400/400', position: 0 },
      { username: 'emma_nomad', section: 'current_life', url: 'https://picsum.photos/seed/emma-life2/400/400', position: 1 },
      // Emma - important (1 photo)
      { username: 'emma_nomad', section: 'important', url: 'https://picsum.photos/seed/emma-imp1/400/400', position: 0 },
    ];

    let addedPhotos = 0;
    let skippedPhotos = 0;

    for (const photo of sectionPhotos) {
      const userId = userIds[photo.username];
      if (userId) {
        // Use url as unique identifier to avoid duplicates
        const result = await client.query(
          `INSERT INTO section_photos (user_id, section, url, position)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [userId, photo.section, photo.url, photo.position]
        );

        if (result.rows.length > 0) {
          addedPhotos++;
        } else {
          skippedPhotos++;
        }
      }
    }

    console.log(`  ✓ Added ${addedPhotos} new section photos`);
    if (skippedPhotos > 0) {
      console.log(`  → Skipped ${skippedPhotos} existing photos`);
    }

    await client.query('COMMIT');

    // Update coordinates for test users (outside transaction for idempotency)
    console.log('\nUpdating coordinates for Globe 3D...');

    const coordinatesUpdates = [
      { email: 'alice@example.com', lat: 48.8566, lon: 2.3522 },   // Paris
      { email: 'bob@example.com', lat: 45.7640, lon: 4.8357 },     // Lyon
      { email: 'claire@example.com', lat: 48.8606, lon: 2.3376 },  // Paris (different area)
      { email: 'david@example.com', lat: 50.8503, lon: 4.3517 },   // Brussels
      { email: 'emma@example.com', lat: 43.2965, lon: 5.3698 },    // Marseille
    ];

    for (const update of coordinatesUpdates) {
      await query(`
        UPDATE users
        SET approximate_latitude = $1,
            approximate_longitude = $2
        WHERE email = $3
      `, [update.lat, update.lon, update.email]);
    }

    console.log('  ✓ Coordinates updated for test users');

    console.log('\nSeeding completed successfully!');
    console.log('\nTest credentials:');
    console.log('  Email: alice@example.com');
    console.log('  Password: Test1234!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
