# Faso Liquidity (prototype)

Moteur de matching de liquidité multi-devises EUR ↔ XOF.

> **Statut : prototype.** Cette version ne déplace aucun argent. Elle calcule
> comment une demande pourrait être servie par plusieurs offres (matching
> fractionné, carnet d'ordres avec exécution partielle).

## Ce qui est dans le projet

- `src/lib/matching.ts` : le moteur de matching (fonction pure, sans effet de bord).
  - matching fractionné : une demande est servie par plusieurs offres ;
  - exécution partielle : une offre partiellement consommée garde son reste ;
  - montants en entiers (centimes d'EUR, XOF) pour éviter les erreurs d'arrondi ;
  - helpers : spread au taux de référence, commission dégressive.
- `src/lib/matching.test.ts` : tests unitaires (Vitest).
- `src/app/` : interface Next.js minimale pour simuler un matching sur des données fictives.

## Démarrer en local

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm test        # lance les tests du moteur
npm run dev     # http://localhost:3000
```

## Ouvrir dans VS Code

1. `File > Open Folder` puis sélectionner ce dossier.
2. VS Code propose d'installer les extensions recommandées (`.vscode/extensions.json`).
3. La sauvegarde formate automatiquement le code (Prettier).

## Déployer sur Vercel

1. Pousser le dépôt sur GitHub.
2. Sur vercel.com : `Add New > Project`, importer le dépôt.
3. Framework détecté automatiquement (Next.js). Aucune variable d'environnement n'est requise pour le prototype.
4. `Deploy`.

## Règles métier actuelles (à valider)

- Taux de référence : 1 EUR = 655,957 XOF (parité fixe du franc CFA).
- Chaque remplissage s'exécute au taux de l'offre (« pay-as-bid »).
- Priorité : taux le plus bas en premier, puis ordre d'arrivée.

## Avant toute mise en production

Ce projet touche à des transferts de fonds. Avant de traiter de l'argent réel, il faudra :

- un avis juridique sur l'agrément nécessaire (change, transfert de fonds) dans chaque pays concerné ;
- un partenaire de paiement ou bancaire agréé pour le règlement ;
- une vérification d'identité (KYC) et une lutte contre le blanchiment (LCB-FT) ;
- une gestion de la protection des données personnelles (RGPD et lois locales).
