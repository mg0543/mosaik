# MEYA (prototype)

En ligne : https://meya-app.vercel.app (l'ancienne adresse mosaik-ten.vercel.app y redirige).

Moteur de matching de liquidité multi-devises EUR ↔ XOF.

> **Statut : prototype.** Cette version ne déplace aucun argent. Elle calcule
> comment une demande pourrait être servie par plusieurs offres (matching
> fractionné, carnet d'ordres avec exécution partielle).

## Ce qui est dans le projet

- `src/lib/` : code pur et testé, partagé entre navigateur et serveur.
  - `matching.ts` : moteur du carnet d'ordres (calcul exact en entiers) ;
  - `policy.ts` : garde-fous (taux à ±15 % de la référence ; 2 000 000 XOF par échange et par jour,
    10 000 000 XOF par mois, alignés sur les limites BCEAO de la monnaie électronique ; 10 demandes
    ouvertes, 30 échanges par heure) ;
  - `quote.ts` : devis du convertisseur (taux choisi automatiquement) ;
  - `payment.ts`, `settlement.ts` : coordonnées de réception (IBAN, mobile money) et protocole de règlement ;
  - `preview.ts`, `format.ts`, `order-status.ts` : aperçu, affichage, statuts.
- `src/server/` : accès à la base et authentification, côté serveur uniquement.
  - `orders.ts` : passage et annulation d'ordres dans une transaction sous verrou ;
  - `queries.ts` : lectures des écrans, toujours filtrées sur l'utilisateur de la session.
- `src/app/(site)/` : accueil, connexion (code à 6 chiffres + lien), simulateur.
- `src/app/app/` : espace connecté (tableau de bord, échanger, mes ordres, compte).
- `supabase/` : migrations SQL et modèle de l'e-mail de connexion.
- `e2e/` : tests de bout en bout (Playwright, Chrome installé).

## Démarrer en local

Prérequis : Node.js 20+, Docker Desktop démarré, CLI Supabase.

```bash
npm install
npm run db:start   # Supabase local : PostgreSQL, Auth, boîte mail de test (http://127.0.0.1:54324)
npm run dev        # http://localhost:3000
```

Créer `.env.local` à partir de `supabase status -o env` :

```
NEXT_PUBLIC_SUPABASE_URL=<API_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
DATABASE_URL=<DB_URL>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Les e-mails de connexion arrivent dans la boîte de test locale, rien n'est réellement envoyé.

## Tests

```bash
npm test           # tests unitaires (moteur, garde-fous, affichage)
npm run test:db    # intégration : base, sécurité, concurrence (Supabase local requis)
npm run test:e2e   # bout en bout dans Chrome : connexion, échange, annulation, mobile
```

## Base de données (Supabase en local)

Prérequis : Docker Desktop démarré et le CLI Supabase.

```bash
npm run db:start   # PostgreSQL + Auth en local, applique les migrations
npm run test:db    # tests d'intégration : matching transactionnel, sécurité, concurrence
npm run db:reset   # recrée la base à partir des migrations
```

- Schéma : `supabase/migrations/`. Tables `orders` et `trades`, montants en `bigint`,
  contraintes qui interdisent les états incohérents.
- Écritures uniquement côté serveur (`src/server/orders.ts`), dans une transaction protégée
  par un verrou du carnet : deux ordres ne peuvent jamais consommer la même contrepartie.
- Les clients ne peuvent que lire leurs propres ordres et échanges (RLS) ; le carnet public
  anonymisé est exposé par la fonction `order_book()`.

## Ouvrir dans VS Code

1. `File > Open Folder` puis sélectionner ce dossier.
2. VS Code propose d'installer les extensions recommandées (`.vscode/extensions.json`).
3. La sauvegarde formate automatiquement le code (Prettier).

## Déployer

Le site est déployé sur Vercel à chaque push sur `main`. Sans base configurée, il affiche
« pilote bientôt ouvert » et seul le simulateur fonctionne.

État actuel : projet Supabase cloud (région Paris, référence `yksscigqkfswgcftjllh`), schéma appliqué et droits
vérifiés sur la base cloud. Le mot de passe de la base est dans `.env.cloud.local`, jamais versionné.

**Dépôt public** : aucun secret ne doit y entrer. Clés et mots de passe vont dans les fichiers
`.env*.local` (ignorés par git) et dans les variables d'environnement de Vercel.

Pour ouvrir le pilote :

1. Créer un projet Supabase (région Europe), puis `supabase link` et `supabase db push`.
2. Dans Supabase > Authentication :
   - URL du site : l'adresse de production ; URL de redirection : `<adresse>/auth/confirm` ;
   - modèles « Magic link » et « Confirm signup » : contenu de `supabase/templates/magic_link.html` ;
   - SMTP : un fournisseur d'e-mails (celui de Supabase est limité à quelques envois par heure).
3. Dans Vercel > Settings > Environment Variables : `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (pooler Supabase, mode transaction, port 6543)
   et `NEXT_PUBLIC_SITE_URL`. Redéployer.

## Comptes

- Inscription (`/inscription`) : prénom, nom, e-mail, téléphone facultatif (format international) et
  mot de passe choisi (10 caractères minimum, avec lettres et chiffres).
- Connexion (`/connexion`) : e-mail et mot de passe. « Mot de passe oublié » envoie un code à 6 chiffres.
- Le profil (prénom, nom, téléphone) est créé par la base en même temps que le compte (table
  `profiles`) et n'est modifiable que par le serveur.

## Inviter un participant au pilote

Par défaut, seules les adresses invitées peuvent créer un compte. `MEYA_INVITE_ONLY=false`
ouvre l'inscription à tous : **c'est le réglage actuel de la production** (variable Vercel).
Pour revenir à l'invitation, supprimer cette variable dans Vercel puis redéployer.
Dans Supabase > SQL Editor :

```sql
insert into public.pilot_invites (email, note) values ('prenom.nom@exemple.com', 'invité par …');
```

## Règlement entre participants (pilote)

MEYA ne reçoit, ne détient ni ne transfère aucun fonds. Chaque échange se règle directement :

1. le preneur (ordre arrivé en dernier) envoie sa part sur les coordonnées du faiseur et le confirme ;
2. le faiseur confirme la réception, envoie sa part et le confirme ;
3. le preneur confirme la réception : l'échange est réglé.

Délai de 24 h ; chacun peut signaler un litige, ce qui gèle le règlement. Les coordonnées de
réception (IBAN, mobile money) sont obligatoires pour passer un ordre et sont figées dans chaque
échange. Les litiges se consultent pour l'instant dans la table `settlements` (`disputed_at`).

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
