import { ImageResponse } from "next/og";
import { BrandIcon } from "@/components/brand-icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon. */
export default function Icon() {
  return new ImageResponse(<BrandIcon size={64} safeZone={0.7} />, size);
}
