import { NextRequest, NextResponse } from "next/server";
import preprocessedData from "@/lib/data/preprocessed_data.json";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoName: string }> }
) {
  const { videoName } = await params;
  const decoded = decodeURIComponent(videoName);
  const stem = decoded.replace(/\.[^/.]+$/, "");

  const analysisMap = preprocessedData.analysis as Record<string, any>;
  const data = analysisMap[decoded] || analysisMap[stem] || analysisMap[`${stem}.mp4`];

  if (data) {
    return NextResponse.json(data);
  }

  // Fallback default structure
  return NextResponse.json({
    video_stem: stem,
    total_vehicles: 0,
    duration: 10,
    vehicles: [],
    all_occurrences: [],
  });
}
