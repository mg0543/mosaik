import { ImageResponse } from "next/og";
import { BrandIcon } from "@/components/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icône de l'écran d'accueil iPhone (iOS arrondit lui-même les coins). */
export default function AppleIcon() {
  return new ImageResponse(<BrandIcon size={180} rounded={false} />, size);
}
