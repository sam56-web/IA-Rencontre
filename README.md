# AI Connect

Application de rencontre relationnelle basée sur le texte et les intentions.

## Vision

AI Connect est une plateforme où les gens se rencontrent par **intention relationnelle** (amour, amitié, projet créatif, discussions...) plutôt que par swipe sur des photos.

### Principes fondateurs

- **Le texte au coeur** : Le profil est une "lettre" en 4 blocs guidés
- **Messagerie directe** : Pas de match préalable - "Je lis, j'écris"
- **Intentions déclarées** : L'utilisateur choisit ce qu'il cherche
- **Géographie = option** : La majorité des usages peuvent être 100% virtuels
- **Modération sérieuse** : Analyse comportementale, pas juste du contenu
- **Freemium éthique** : Limiter l'initiative, pas la relation

## Stack technique

### Backend
- Node.js 20+ / TypeScript 5+
- Express 4 (API REST)
- WebSocket (ws)
- PostgreSQL 15
- Redis 7

### Frontend
- React 18+ / TypeScript 5+
- Vite 5+
- TailwindCSS 3+
- React Router 6+
- Zustand (state)
- React Query (data fetching)

### Infrastructure
- Docker / Docker Compose

## Démarrage rapide

### Prérequis
- Docker et Docker Compose
- Node.js 20+ (pour le développement local sans Docker)

### Avec Docker (recommandé)

```bash
# Cloner et entrer dans le projet
cd ai-connect

# Copier les variables d'environnement
cp .env.example .env

# Lancer tous les services
docker-compose up -d

# Exécuter les migrations
docker-compose exec backend npm run db:migrate

# (Optionnel) Charger les données de test
docker-compose exec backend npm run db:seed
```

L'application sera accessible sur :
- Frontend : http://localhost:5173
- API : http://localhost:3000
- WebSocket : ws://localhost:3000/ws

### Développement local (sans Docker)

```bash
# Démarrer PostgreSQL et Redis (avec Docker)
docker-compose up -d postgres redis

# Backend
cd backend
npm install
cp ../.env.example .env
npm run db:migrate
npm run db:seed
npm run dev

# Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev
```

## Comptes de test

Après avoir exécuté les seeds :

| Email | Mot de passe | Description |
|-------|--------------|-------------|
| alice@example.com | Test1234! | Rédactrice à Paris |
| bob@example.com | Test1234! | Développeur à Lyon |
| claire@example.com | Test1234! | Illustratrice à Paris |
| david@example.com | Test1234! | Professeur à Bruxelles |
| emma@example.com | Test1234! | Digital nomad à Marseille |

## Structure du projet

```
ai-connect/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── app.ts                # Express setup
│   │   ├── config/               # Configuration
│   │   ├── api/
│   │   │   ├── routes/           # API endpoints
│   │   │   └── middleware/       # Auth, error handling, rate limiting
│   │   ├── services/             # Business logic
│   │   ├── ws/                   # WebSocket server
│   │   ├── db/                   # Database (pool, migrations, seeds)
│   │   ├── utils/                # Helpers
│   │   └── types/                # TypeScript types
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx              # Entry point
│   │   ├── App.tsx               # Router setup
│   │   ├── components/           # UI components
│   │   ├── pages/                # Page components
│   │   ├── hooks/                # React hooks
│   │   ├── stores/               # Zustand stores
│   │   ├── services/             # API client, WebSocket
│   │   └── types/                # TypeScript types
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/refresh` - Rafraîchir le token
- `POST /api/auth/logout` - Déconnexion

### Users
- `GET /api/users/me` - Profil utilisateur
- `PATCH /api/users/me` - Modifier ses infos
- `POST /api/users/me/pause` - Mettre en pause
- `POST /api/users/me/unpause` - Reprendre
- `DELETE /api/users/me` - Supprimer le compte

### Profiles
- `GET /api/profiles/me` - Mon profil texte
- `POST /api/profiles` - Créer mon profil
- `PATCH /api/profiles` - Modifier mon profil
- `GET /api/profiles/:userId` - Voir un profil

### Photos
- `GET /api/photos` - Mes photos
- `POST /api/photos` - Upload photo
- `DELETE /api/photos/:id` - Supprimer photo
- `PATCH /api/photos/reorder` - Réordonner

### Discovery
- `GET /api/discover` - Feed de profils
- `GET /api/discover/serendipity` - Profils variés
- `GET /api/discover/zones/vitality` - Vitalité de zone

### Conversations & Messages
- `GET /api/conversations` - Mes conversations
- `POST /api/conversations` - Démarrer une conversation
- `GET /api/conversations/:id` - Détail conversation
- `POST /api/conversations/:id/archive` - Archiver
- `GET /api/conversations/:id/messages` - Messages
- `POST /api/conversations/:id/messages` - Envoyer message
- `POST /api/conversations/:id/read` - Marquer comme lus

## WebSocket

Connexion : `ws://localhost:3000/ws?token=JWT_TOKEN`

### Messages client → serveur
```json
{ "type": "send_message", "payload": { "conversationId": "...", "content": "...", "tempId": "..." } }
{ "type": "typing", "payload": { "conversationId": "...", "isTyping": true } }
{ "type": "ping", "payload": {} }
```

### Messages serveur → client
```json
{ "type": "connected", "payload": { "userId": "..." } }
{ "type": "message_new", "payload": { "conversationId": "...", "message": {...} } }
{ "type": "message_sent", "payload": { "tempId": "...", "message": {...} } }
{ "type": "typing_update", "payload": { "conversationId": "...", "userId": "...", "isTyping": true } }
{ "type": "presence_update", "payload": { "userId": "...", "isOnline": true } }
```

## Modèle freemium

- **Gratuit** : 3 nouvelles conversations par semaine
- **Premium** : Conversations illimitées (max 10€/mois)

Répondre dans une conversation existante est toujours gratuit.

## Licence

Projet privé - Tous droits réservés
