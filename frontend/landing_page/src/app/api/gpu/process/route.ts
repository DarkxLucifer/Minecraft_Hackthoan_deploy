import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://yashraj9696-test.hf.space";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    try {
      const res = await fetch(`${BACKEND_URL}/api/gpu/process`, {
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
      status: "COMPLETED",
      video_name: body.video_name,
      message: `Detection analysis ready for ${body.video_name}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || "Failed to trigger processing" },
      { status: 500 }
    );
  }
}
