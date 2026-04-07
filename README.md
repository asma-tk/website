# MaçoNova Bâtiment

Nom de site proposé (créatif et original) : **MaçoNova Bâtiment**.

> Remarque : je ne peux pas garantir à 100% qu'un nom n'a jamais été utilisé dans le monde, mais celui-ci est inventé et peu commun.

## Stack

- HTML + CSS + JavaScript (frontend)
- FastAPI (serveur Python)
- WebSocket (`/ws`) pour statut en direct
- Formulaire de contact avec envoi email (SMTP)

## Installation

```bash
python -m pip install -r requirements.txt
```

## Configuration email

1. Copier l'exemple de variables d'environnement :

```bash
cp .env.example .env
```

2. Modifier `.env` avec vos infos SMTP et votre adresse de réception.

Par défaut, les demandes partent vers `macon.novaa@gmail.com` (modifiable via `CONTACT_TO`).

Configuration Gmail recommandée dans `.env` :

```dotenv
CONTACT_TO=macon.novaa@gmail.com
CONTACT_FROM=macon.novaa@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=macon.novaa@gmail.com
SMTP_PASS=VOTRE_MOT_DE_PASSE_APPLICATION_GMAIL
```

Important : pour Gmail, utilisez un **mot de passe d'application** (pas votre mot de passe normal) avec la validation en 2 étapes activée.

## Lancer le site

```bash
uvicorn app.main:app --reload --port 3000
```

Puis ouvrir `http://localhost:3000`.

## Lancer avec Docker

1. Copier le fichier d'environnement si nécessaire :

```bash
cp .env.example .env
```

2. Build + run avec `docker compose` :

```bash
docker compose up --build
```

3. Ouvrir `http://localhost:3000`.

Commandes utiles :

```bash
docker compose down
docker compose logs -f
```

Alternative sans compose :

```bash
docker build -t ma9onnova-web .
docker run --rm -p 3000:3000 --env-file .env ma9onnova-web
```

## Tests

```bash
pytest
```

## Déploiement Render (Node.js)

Le dépôt contient un `server.js` Node/Express avec un endpoint santé `GET /api/health`.

### Option 1 — One-click via Blueprint

Le fichier `render.yaml` est déjà prêt.

1. Aller sur Render → **New** → **Blueprint**.
2. Connecter le repo `asma-tk/website`.
3. Lancer le déploiement.

### Option 2 — Configuration manuelle

Créer un **Web Service** avec :

- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`

Après déploiement, vérifier :

```bash
curl -s https://<ton-service>.onrender.com/api/health
```

## Déploiement Netlify (Frontend + Functions)

Le dépôt est prêt pour Netlify avec :

- `public/` comme dossier statique
- `netlify/functions/contact.js` pour `POST /api/contact`
- `netlify/functions/health.js` pour `GET /api/health`
- `netlify.toml` pour les redirections API

### Configuration Netlify

- **Build command**: *(laisser vide)*
- **Publish directory**: `public`

### Variables d'environnement (Site settings → Environment variables)

Configurer au minimum :

```dotenv
CONTACT_TO=macon.novaa@gmail.com
CONTACT_FROM=macon.novaa@gmail.com
```

Pour envoi réel SMTP (Brevo recommandé) :

```dotenv
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_SECURE=false
BREVO_SMTP_USER=VOTRE_USER_BREVO
BREVO_SMTP_PASS=VOTRE_PASS_BREVO
```

Test après déploiement :

```bash
curl -s https://<votre-site-netlify>/api/health
curl -X POST https://<votre-site-netlify>/api/contact \
	-H "Content-Type: application/json" \
	-d '{"nom":"Test","email":"test@example.com","telephone":"0600000000","message":"Message de test assez long"}'
```

Note : Netlify ne garde pas de serveur WebSocket permanent sur ce setup, le bloc “statut en direct” passe automatiquement en mode indisponible.

## Fonctionnement du formulaire

- Le formulaire envoie les données vers `POST /api/contact`.
- Le serveur valide les champs (`nom`, `email`, `message`).
- L'email est envoyé vers `CONTACT_TO` via SMTP.
- Si SMTP est absent/invalide, l'API renvoie une erreur claire (pas de faux succès).
- À chaque nouvelle demande, un événement WebSocket est diffusé en direct.

## Structure

```text
.
├── app/
│   ├── main.py
│   └── validation.py
├── public/
│   ├── index.html
│   ├── script.js
│   └── styles.css
├── tests/
│   └── test_validation.py
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── requirements.txt
└── .env.example
```