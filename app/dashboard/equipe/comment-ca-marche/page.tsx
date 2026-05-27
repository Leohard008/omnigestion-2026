export default function HowItWorksPage() {
  return (
    <article className="prose prose-slate max-w-3xl">
      <h1>Comment fonctionne le module Équipe</h1>

      <h2>Quelles données sont collectées</h2>
      <ul>
        <li>
          Les <strong>tâches</strong> que vous créez ou qui vous sont assignées (titre, description,
          échéance, priorité, estimation).
        </li>
        <li>
          Les <strong>changements de statut</strong> (TODO → En cours → Bloquée → Terminée), avec
          horodatage et auteur.
        </li>
        <li>
          Les <strong>sessions de timer</strong> liées à vos passages en &quot;En cours&quot; : début, fin, durée.
        </li>
        <li>
          L&apos;<strong>historique d&apos;édition</strong> de chaque session (qui a modifié quoi, quand, et
          pourquoi).
        </li>
      </ul>

      <h2>Qui voit quoi</h2>
      <ul>
        <li>
          <strong>Vous</strong> : toutes vos tâches, vos sessions, vos métriques personnelles.
        </li>
        <li>
          <strong>Votre manager</strong> (par équipe) : les tâches et métriques des membres de son
          équipe.
        </li>
        <li>
          <strong>OWNER / ADMIN de l&apos;organisation</strong> : tout, dans toutes les équipes.
        </li>
        <li>
          <strong>Vos collègues</strong> : ne voient ni vos tâches ni vos métriques individuelles.
        </li>
      </ul>

      <h2>Comment éditer une session de timer</h2>
      <p>
        Si vous avez oublié de stopper le timer ou que la durée enregistrée est incorrecte, ouvrez
        la tâche concernée et cliquez sur <em>Éditer</em> à côté de la session. Vous pouvez modifier
        votre session dans les <strong>24 h suivant sa clôture</strong>. Au-delà, seul votre manager
        ou un admin peut intervenir — en laissant une trace dans l&apos;historique d&apos;édition.
      </p>

      <h2>Comment fonctionnent les anomalies</h2>
      <p>
        Le système signale automatiquement à votre manager certaines situations qui peuvent demander
        une discussion :
      </p>
      <ul>
        <li>Tâche en retard par rapport à son échéance</li>
        <li>Tâche bloquée depuis plus de 48 h</li>
        <li>Plus de 5 tâches en cours sur un membre</li>
        <li>
          Écart inhabituel entre le temps en &quot;En cours&quot; et le temps réellement tracké (peut indiquer
          une session non clôturée)
        </li>
        <li>Plus de 50 % du cycle de la tâche passé en &quot;Bloquée&quot; (cause externe à investiguer)</li>
      </ul>
      <p>
        Ces signalements sont des <strong>flags neutres</strong>, jamais des accusations.
      </p>

      <h2>Combien de temps les données sont conservées</h2>
      <p>
        Tant que votre compte est actif, les données du module sont conservées sans limite de durée.
        Pour exercer vos droits (accès, suppression), contactez l&apos;administrateur de votre
        organisation.
      </p>

      <h2>Pas de classement</h2>
      <p>
        Aucune vue ne montre de classement public des membres. Les métriques servent à{" "}
        <strong>débloquer le travail</strong>, pas à comparer ou sanctionner.
      </p>
    </article>
  );
}
