import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, Todo } from "@/components/legal";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function PrivacyPage() {
  return (
    <article className="legal">
      <h1>Politique de confidentialité</h1>
      <DraftNotice />

      <h2>Qui est responsable de vos données</h2>
      <p>
        Le responsable du traitement est <Todo>nom ou raison sociale de l&apos;éditeur, adresse</Todo>.
        Contact pour toute question sur vos données : <Todo>adresse e-mail de contact</Todo>.
      </p>

      <h2>Quelles données nous traitons</h2>
      <ul>
        <li><strong>Votre adresse e-mail</strong>, pour créer votre compte et vous envoyer vos codes de connexion.</li>
        <li><strong>Vos ordres et vos échanges</strong> : sens, montants, taux, dates et statuts.</li>
        <li>
          <strong>Des cookies de session</strong>, strictement nécessaires pour vous garder connecté. Ils ne
          servent ni à la publicité ni à la mesure d&apos;audience.
        </li>
        <li>
          <strong>Des journaux techniques</strong> tenus par nos hébergeurs (adresse IP, date et heure des
          requêtes), pour la sécurité et le bon fonctionnement du service.
        </li>
      </ul>
      <p>
        Nous n&apos;utilisons aucun outil de publicité ni de mesure d&apos;audience, et nous ne vendons aucune
        donnée. Votre appareil garde seulement une préférence d&apos;affichage (le message d&apos;installation
        sur iPhone déjà fermé), qui ne quitte jamais votre appareil.
      </p>

      <h2>Pourquoi nous les traitons</h2>
      <ul>
        <li>Gérer votre compte et votre connexion.</li>
        <li>Enregistrer vos ordres et les apparier avec ceux d&apos;autres participants.</li>
        <li>Assurer la sécurité du service et prévenir les abus (limites d&apos;activité, journaux).</li>
      </ul>
      <p>
        Ces traitements reposent sur l&apos;exécution du service que vous demandez et sur notre intérêt
        légitime à le sécuriser. <Todo>bases légales à confirmer par un juriste</Todo>
      </p>

      <h2>Ce que voient les autres participants</h2>
      <p>
        Personne ne voit votre adresse e-mail. Les autres participants voient seulement le carnet
        d&apos;ordres anonyme : sens, montant restant et taux de chaque ordre en attente. Dans le détail de
        vos échanges, vos contreparties sont désignées par un numéro, jamais par leur identité.
      </p>

      <h2>Où sont vos données et qui y a accès</h2>
      <ul>
        <li>
          <strong>Supabase</strong> héberge la base de données et l&apos;authentification, en Union
          européenne (région de Paris).
        </li>
        <li>
          <strong>Vercel</strong> héberge le site. Cette société est établie aux États-Unis.{" "}
          <Todo>garanties encadrant les transferts hors UE, à confirmer</Todo>
        </li>
        <li><Todo>fournisseur d&apos;envoi des e-mails, une fois choisi</Todo></li>
      </ul>

      <h2>Combien de temps nous les gardons</h2>
      <p>
        Votre adresse e-mail est conservée tant que votre compte existe. Les ordres et les échanges sont
        conservés <Todo>durée de conservation, notamment au regard des obligations légales</Todo>.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l&apos;accès à vos données, leur rectification, leur effacement, leur
        portabilité, ou vous opposer à leur traitement, en écrivant à <Todo>adresse e-mail de contact</Todo>.
        Vous pouvez aussi saisir l&apos;autorité de protection des données de votre pays : la CNIL en
        France, ou l&apos;autorité compétente de votre pays de résidence.
      </p>

      <p className="legal-meta">
        Voir aussi les <Link href="/conditions">conditions du pilote</Link>.
      </p>
    </article>
  );
}
