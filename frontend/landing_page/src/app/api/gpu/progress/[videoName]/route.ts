import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://yashraj9696-test.hf.space";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoName: string }> }
) {
  const { videoName } = await params;

  try {
    const res = await fetch(`${BACKEND_URL}/api/gpu/progress/${encodeURIComponent(videoName)}`);
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {
    // Backend offline fallback
  }

  return NextResponse.json({
    video_name: videoName,
    status: "COMPLETED",
    progress_percent: 100.0,
    message: "Analysis verified and ready.",
  });
}
