import postgres from "postgres";

/**
 * Connexion PostgreSQL, côté serveur uniquement (jamais importée par un composant client).
 * Les bigint (montants, ordre d'arrivée) sont convertis en number, avec contrôle : un montant
 * qui dépasserait la précision exacte d'un number provoque une erreur plutôt qu'un arrondi.
 */
export type Sql = postgres.Sql<{ bigint: number }>;

/** Connexion ou transaction en cours : les lectures acceptent l'une comme l'autre. */
export type Queryable = Sql | postgres.TransactionSql<{ bigint: number }>;

export function createSql(url: string, options: { max?: number } = {}): Sql {
  return postgres(url, {
    max: options.max ?? 5,
    // Compatible avec le pooler Supabase en mode transaction (déploiement serverless).
    prepare: false,
    types: {
      bigint: {
        to: 20,
        from: [20],
        serialize: (value: number) => String(value),
        parse: (value: string) => {
          const n = Number(value);
          if (!Number.isSafeInteger(n)) throw new RangeError(`Entier hors de la précision exacte : ${value}`);
          return n;
        },
      },
    },
  });
}

let shared: Sql | undefined;

/** Connexion partagée, créée à la première utilisation à partir de DATABASE_URL. */
export function getSql(): Sql {
  if (!shared) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL n'est pas défini.");
    shared = createSql(url);
  }
  return shared;
}
