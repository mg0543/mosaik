# Mosaik (prototype)

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
- **Carnet d'ordres à deux côtés** (`placeOrder`) : vendeurs d'EUR (`SELL_EUR`, taux minimum)
  et vendeurs de XOF (`SELL_XOF`, taux maximum). Un nouvel ordre se croise d'abord avec le
  côté opposé ; son reste s'inscrit au carnet à son taux limite.
- Priorité : meilleur taux pour l'ordre entrant, puis ordre d'arrivée.
- Chaque échange s'exécute au taux de l'ordre déjà inscrit (« pay-as-bid »).
- Un utilisateur n'est jamais apparié avec lui-même.
- **Calcul exact** : montants en entiers (centimes, XOF), taux en millièmes de XOF par euro
  (`655957` = 655,957), produits et divisions en `BigInt`. Aucun flottant dans les calculs d'argent.
  Les saisies sont lues par `parseEurCents`, `parseXof` et `parseRate`, sans passer par un flottant.
- Arrondi : le pivot est un nombre entier de centimes, le XOF est arrondi à l'inférieur.
  Personne ne donne plus que ce qu'il a engagé.
- **Restes techniques** : un ordre dont le reste vaut moins d'1 centime à son taux ne pourra
  jamais être apparié. Il est clôturé et signalé dans `closed`, jamais masqué.

## Avant toute mise en production

Ce projet touche à des transferts de fonds. Avant de traiter de l'argent réel, il faudra :

- un avis juridique sur l'agrément nécessaire (change, transfert de fonds) dans chaque pays concerné ;
- un partenaire de paiement ou bancaire agréé pour le règlement ;
- une vérification d'identité (KYC) et une lutte contre le blanchiment (LCB-FT) ;
- une gestion de la protection des données personnelles (RGPD et lois locales).
