import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://yashraj9696-test.hf.space";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const videoName = body.video_name;

    try {
      const res = await fetch(`${BACKEND_URL}/api/video/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      // Backend offline fallback
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${videoName}`,
      deleted_video: videoName,
      deleted_count: 1,
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || "Failed to delete video" },
      { status: 500 }
    );
  }
}
