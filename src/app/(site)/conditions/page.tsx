import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice, Todo } from "@/components/legal";
import { MAX_OPEN_ORDERS, MAX_ORDER_XOF, MAX_ORDERS_PER_HOUR, RATE_BAND_PCT } from "@/lib/policy";

export const metadata: Metadata = { title: "Conditions du pilote" };

export default function TermsPage() {
  return (
    <article className="legal">
      <h1>Conditions du pilote</h1>
      <DraftNotice />

      <h2>1. Objet</h2>
      <p>
        MEYA est un service en phase pilote, édité par <Todo>nom ou raison sociale de l&apos;éditeur</Todo>.
        Il permet à des particuliers de passer des ordres d&apos;échange entre euros et francs CFA (XOF) et
        calcule comment ces ordres se répondent.
      </p>

      <h2>2. Ce que MEYA ne fait pas</h2>
      <p>
        Pendant le pilote, MEYA ne reçoit, ne détient, ne transfère ni ne convertit aucun fonds. MEYA
        n&apos;intervient dans aucun paiement entre participants.
      </p>

      <h2>3. Fonctionnement des ordres</h2>
      <ul>
        <li>
          Vous indiquez un montant et un taux limite : le minimum que vous acceptez de recevoir, ou le
          maximum que vous acceptez de donner, en XOF pour 1 euro.
        </li>
        <li>
          Votre ordre est apparié avec les ordres en attente les plus avantageux pour vous, puis par ordre
          d&apos;arrivée. Chaque échange se fait au taux de l&apos;ordre qui attendait, donc jamais au-delà de
          votre taux limite.
        </li>
        <li>
          Un ordre peut être servi par plusieurs participants. La partie non servie attend dans le carnet
          jusqu&apos;à ce qu&apos;un autre participant la croise, ou jusqu&apos;à ce que vous l&apos;annuliez.
        </li>
        <li>
          Les montants sont calculés en centimes et en XOF entiers, arrondis à l&apos;inférieur. Un reste de
          moins d&apos;un centime, qui ne peut pas être échangé, vous est toujours indiqué.
        </li>
        <li>Un échange enregistré ne peut plus être modifié ni annulé dans MEYA.</li>
      </ul>

      <h2>4. Limites du pilote</h2>
      <ul>
        <li>Montant maximal par ordre : {MAX_ORDER_XOF.toLocaleString("fr-FR")} XOF ou l&apos;équivalent en euros.</li>
        <li>Taux limite compris à ±{RATE_BAND_PCT} % du taux de référence (1 € = 655,957 XOF).</li>
        <li>Au plus {MAX_OPEN_ORDERS} ordres en attente et {MAX_ORDERS_PER_HOUR} ordres par heure par participant.</li>
      </ul>

      <h2>5. Règlement entre participants</h2>
      <p>
        Chaque échange se règle directement entre les deux participants, sans que l&apos;argent transite
        par MEYA :
      </p>
      <ol>
        <li>
          le participant dont l&apos;ordre est arrivé en dernier envoie sa part en premier, sur les
          coordonnées indiquées par MEYA, et le confirme ;
        </li>
        <li>l&apos;autre participant vérifie la réception, le confirme, puis envoie sa part et le confirme ;</li>
        <li>le premier confirme la réception : l&apos;échange est réglé.</li>
      </ol>
      <p>
        Le règlement doit être fait dans les 24 heures suivant l&apos;échange. Chaque participant peut
        signaler un problème à tout moment avant la fin du règlement ; le règlement est alors gelé.
        MEYA ne garantit pas le paiement par la contrepartie et ne peut pas annuler un paiement effectué.
        Pour passer un ordre, vous devez renseigner les coordonnées où vous souhaitez être payé.{" "}
        <Todo>traitement des litiges, des retards et conséquences pour le participant défaillant</Todo>
      </p>

      <h2>6. Vos engagements</h2>
      <ul>
        <li>Utiliser MEYA à titre personnel, avec un seul compte, et à partir de fonds dont l&apos;origine est licite.</li>
        <li>
          Ne pas utiliser MEYA pour blanchir de l&apos;argent, financer une activité illégale, frauder ou
          contourner une réglementation des changes.
        </li>
        <li>Ne pas perturber le service ni tenter d&apos;accéder aux données d&apos;autres participants.</li>
      </ul>

      <h2>7. Suspension et fin du pilote</h2>
      <p>
        L&apos;éditeur peut suspendre un compte en cas de manquement à ces conditions, et peut modifier ou
        arrêter le pilote. <Todo>préavis et conséquences pour les ordres en attente</Todo>
      </p>

      <h2>8. Responsabilité, droit applicable et contact</h2>
      <p>
        <Todo>limites de responsabilité, droit applicable et juridiction compétente</Todo>
        <br />
        Contact : <Todo>adresse e-mail de contact</Todo>
      </p>

      <p className="legal-meta">
        Voir aussi la <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>
    </article>
  );
}
