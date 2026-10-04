import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoName: string }> }
) {
  const { videoName } = await params;
  const { searchParams } = new URL(req.url);
  const plate = searchParams.get("plate");
  const frame = searchParams.get("frame");

  const vstem = videoName.replace(/\.mp4$/i, "");
  const publicCropsDir = path.join(process.cwd(), "public", "crops");

  // Candidate filename 1: <vstem>_frame<frame>_<plate>.jpg
  if (frame && plate) {
    const candidate1 = path.join(publicCropsDir, `${vstem}_frame${frame}_${plate}.jpg`);
    try {
      const fileBuffer = await fs.readFile(candidate1);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {}
  }

  // Candidate filename 2: any file in crops starting with <vstem> and ending with <plate>.jpg
  if (plate) {
    try {
      const files = await fs.readdir(publicCropsDir);
      const match = files.find(
        (f) => f.includes(plate) || (f.startsWith(vstem) && f.endsWith(".jpg"))
      );
      if (match) {
        const fileBuffer = await fs.readFile(path.join(publicCropsDir, match));
        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    } catch {}
  }

  // Return transparent SVG 1x1 fallback instead of 404 error
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180" fill="#0b0f17">
    <rect width="320" height="180" fill="#0b0f17"/>
    <text x="160" y="95" fill="#64748b" font-family="monospace" font-size="12" text-anchor="middle">Frame Sighting Snapshot</text>
  </svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
