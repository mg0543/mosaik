/**
 * Drapeaux ronds dessinés en SVG (Windows n'affiche pas les drapeaux en emoji).
 * EUR : drapeau européen ; XOF : pays de l'UEMOA choisi par l'utilisateur.
 */
import type { XofCountry } from "@/lib/countries";

export type FlagCode = "EU" | XofCountry;

const star = (cx: number, cy: number, r: number, fill: string) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.42;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
  return <polygon points={points} fill={fill} />;
};

function FlagShapes({ code }: { code: FlagCode }) {
  switch (code) {
    case "EU":
      return (
        <>
          <rect width="24" height="24" fill="#003399" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (Math.PI / 6) * i;
            return <circle key={i} cx={12 + 6.5 * Math.cos(a)} cy={12 + 6.5 * Math.sin(a)} r="1.1" fill="#FFCC00" />;
          })}
        </>
      );
    case "SN":
      return (<><rect width="8" height="24" fill="#00853F" /><rect x="8" width="8" height="24" fill="#FDEF42" /><rect x="16" width="8" height="24" fill="#E31B23" />{star(12, 12, 3.4, "#00853F")}</>);
    case "CI":
      return (<><rect width="8" height="24" fill="#F77F00" /><rect x="8" width="8" height="24" fill="#FFFFFF" /><rect x="16" width="8" height="24" fill="#009E60" /></>);
    case "ML":
      return (<><rect width="8" height="24" fill="#14B53A" /><rect x="8" width="8" height="24" fill="#FCD116" /><rect x="16" width="8" height="24" fill="#CE1126" /></>);
    case "BF":
      return (<><rect width="24" height="12" fill="#EF2B2D" /><rect y="12" width="24" height="12" fill="#009E49" />{star(12, 12, 3.6, "#FCD116")}</>);
    case "BJ":
      return (<><rect width="24" height="24" fill="#FCD116" /><rect y="12" width="24" height="12" fill="#E8112D" /><rect width="9" height="24" fill="#008751" /></>);
    case "TG":
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} y={i * 4.8} width="24" height="4.8" fill={i % 2 === 0 ? "#006A4E" : "#FFCE00"} />)}
          <rect width="11" height="14.4" fill="#D21034" />
          {star(5.5, 7.2, 3, "#FFFFFF")}
        </>
      );
    case "NE":
      return (<><rect width="24" height="8" fill="#E05206" /><rect y="8" width="24" height="8" fill="#FFFFFF" /><rect y="16" width="24" height="8" fill="#0DB02B" /><circle cx="12" cy="12" r="2.6" fill="#E05206" /></>);
    case "GW":
      return (<><rect width="24" height="12" fill="#FCD116" /><rect y="12" width="24" height="12" fill="#009E49" /><rect width="9" height="24" fill="#CE1126" />{star(4.5, 12, 2.8, "#000000")}</>);
  }
}

export function Flag({ code, size = 24 }: { code: FlagCode; size?: number }) {
  const id = `flag-${code}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="flag">
      <defs><clipPath id={id}><circle cx="12" cy="12" r="12" /></clipPath></defs>
      <g clipPath={`url(#${id})`}><FlagShapes code={code} /></g>
      <circle cx="12" cy="12" r="11.5" fill="none" stroke="rgb(0 0 0 / 0.08)" />
    </svg>
  );
}
