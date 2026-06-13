import { ImageResponse } from "next/og"

export const runtime = "edge"

// FontAwesome 6 Free Solid: fa-house (Unicode f015)
// SVG path extraído da biblioteca FontAwesome
const HOUSE_PATH =
  "M575.8 255.5c0 18-15 32.1-32 32.1h-32l.7 160.2c0 2.7-.2 5.4-.5 8.1V472c0 22.1-17.9 40-40 40H456c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1H416 392c-22.1 0-40-17.9-40-40V448 384c0-17.7-14.3-32-32-32H256c-17.7 0-32 14.3-32 32v64 24c0 22.1-17.9 40-40 40H160 128.1c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2H104c-22.1 0-40-17.9-40-40V360c0-.9 0-1.9 .1-2.8V287.6H32c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 11 15 11 24z"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: rawSize } = await params
  const url = new URL(req.url)
  const maskable = url.searchParams.get("maskable") === "1"

  const size = Math.max(32, Math.min(1024, parseInt(rawSize, 10) || 192))
  // Para maskable, o conteúdo deve ocupar ~80% da área (safe zone)
  const iconScale = maskable ? 0.5 : 0.6
  const borderRadius = maskable ? 0 : size * 0.22

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)",
          borderRadius,
        }}
      >
        <svg
          width={size * iconScale}
          height={size * iconScale}
          viewBox="0 0 576 512"
          fill="#f8fafc"
        >
          <path d={HOUSE_PATH} />
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}
