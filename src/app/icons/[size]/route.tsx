import { ImageResponse } from "next/og";
import { BrandIcon } from "@/components/brand-icon";

// Icônes du manifeste, générées une fois au build.
const ICONS = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
} as const;

export function generateStaticParams() {
  return Object.keys(ICONS).map((size) => ({ size }));
}

export const dynamicParams = false;

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const icon = ICONS[size as keyof typeof ICONS];
  return new ImageResponse(
    icon.maskable ? <BrandIcon size={icon.size} safeZone={0.5} rounded={false} /> : <BrandIcon size={icon.size} rounded={false} />,
    { width: icon.size, height: icon.size },
  );
}
