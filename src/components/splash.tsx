/**
 * Écran d'ouverture MEYA : un anneau en rotation, deux pièces (euro et franc CFA) en orbite,
 * le « M » qui se dessine, puis le nom et le slogan. Purement HTML/CSS : il s'affiche dès le
 * premier rendu, sans attendre le JavaScript, et s'efface seul (voir meya.css).
 *
 * Il n'apparaît qu'une fois par visite : le petit script ci-dessous, exécuté avant que l'écran
 * ne soit peint, le masque si la visite l'a déjà montré. Il ne bloque jamais les clics.
 */
const ONCE_PER_VISIT = `try{var k="meya:splash-seen";if(sessionStorage.getItem(k)){document.documentElement.classList.add("no-splash")}else{sessionStorage.setItem(k,"1")}}catch(e){}`;

export function Splash() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: ONCE_PER_VISIT }} />
      <div className="splash" aria-hidden="true">
        <div className="splash-stage">
          <svg className="splash-art" viewBox="0 0 200 200" width="200" height="200">
            <circle className="splash-ring" cx="100" cy="100" r="78" />
            <g className="splash-orbit">
              <circle cx="100" cy="22" r="11" className="splash-coin eur" />
              <text x="100" y="26.5" textAnchor="middle" className="splash-coin-text">€</text>
            </g>
            <g className="splash-orbit">
              <circle cx="100" cy="178" r="11" className="splash-coin xof" />
              <text x="100" y="181.5" textAnchor="middle" className="splash-coin-text small">CFA</text>
            </g>
            <rect x="58" y="58" width="84" height="84" rx="24" className="splash-tile" />
            <path d="M80 122V80l20 22 20-22v42" className="splash-m" />
          </svg>
          <div className="splash-word">
            {"MEYA".split("").map((letter, i) => (
              <span key={i} style={{ animationDelay: `${0.75 + i * 0.08}s` }}>{letter}</span>
            ))}
          </div>
          <p className="splash-tagline">Euro ⇄ Franc CFA, entre particuliers</p>
          <div className="splash-dots"><span /><span /><span /></div>
        </div>
      </div>
    </>
  );
}
