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