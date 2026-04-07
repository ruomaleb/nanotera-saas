# Nanotera SaaS Frontend

Plateforme React + Vite + TypeScript + Tailwind pour l'agent d'optimisation logistique Nanotera.

## Stack

- **React 19** + **Vite 6** + **TypeScript**
- **Tailwind CSS** pour le styling
- **Supabase JS** pour le CRUD direct (referentiel, operations, palettes)
- **FastAPI backend** pour les operations Python lourdes (import, bin-packing, generation documents)

## Pages

- **Enseignes** — CRUD enseignes + centrales associees
- **Supports** — Types de supports et conditionnements
- **Modeles** — Templates de documents
- **Operations** — Liste, creation, detail
- **Import** — Upload du fichier client → ingestion + normalisation + controles
- **Analyse** — Resultats des controles qualite
- **Palettisation** — Composition des palettes par centrale
- **Livrables** — Generation des 8 documents finaux

## Configuration locale

```bash
npm install
cp .env.example .env
# Editer .env avec les vraies valeurs Supabase et l'URL backend
npm run dev
```

## Variables d'environnement

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Cle anon publique du projet Supabase |
| `VITE_API_URL` | URL du backend FastAPI (local ou production) |

## Deploiement

Auto-deploy via **Vercel** sur push vers `main`.
