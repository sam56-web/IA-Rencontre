# Regles Obligatoires pour Claude - AI-Connect

## Avant CHAQUE Modification

1. **Verifier l'etat de l'app** : `./scripts/health-check.sh`
2. **Si echec** : `./scripts/auto-fix.sh` avant de continuer

## Regles de Modification

### Ne Jamais Faire
- Creer de nouveaux fichiers sauf si explicitement demande
- Restructurer l'architecture existante
- Renommer des fichiers ou dossiers
- Supprimer du code fonctionnel
- Ajouter des dependances sans demander

### Toujours Faire
- Modifier les fichiers existants uniquement
- Tester apres chaque modification
- Commiter regulierement avec messages clairs
- Verifier les logs en cas d'erreur

## Apres CHAQUE Modification

1. Executer `./scripts/health-check.sh`
2. Si echec, corriger immediatement
3. Ne pas continuer tant que l'app ne fonctionne pas

## Debug

### Si l'app ne demarre pas
```bash
./scripts/auto-fix.sh
```

### Si rate limiting (429)
```bash
docker compose restart backend
```

### Voir les logs
```bash
docker compose logs backend --tail=50
docker compose logs frontend --tail=50
```

## Commandes Utiles

```bash
# Demarrer l'app
docker compose up -d

# Arreter l'app
docker compose down

# Reconstruire
docker compose build --no-cache

# Verification sante
./scripts/health-check.sh

# Reparation automatique
./scripts/auto-fix.sh
```
