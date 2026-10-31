import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

let logo: Promise<string> | null = null;
const logoDataUrl = () =>
  (logo ??= readFile(join(process.cwd(), "public/brand/lester-script.png")).then(
    (b) => `data:image/png;base64,${b.toString("base64")}`,
  ));

/** App/PWA icon: the "Lester" script wordmark (from Jefeeer/hostles) on the stage-black tile. */
export async function brandIcon(size: number, { maskable = false } = {}) {
  const src = await logoDataUrl();
  // Maskable icons get cropped to a circle by Android, so keep the mark in the safe zone.
  const w = Math.round(size * (maskable ? 0.62 : 0.84));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e0c0b",
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={w} height={Math.round((w * 580) / 860)} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
