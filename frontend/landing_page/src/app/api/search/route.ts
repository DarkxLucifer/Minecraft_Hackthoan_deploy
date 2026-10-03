import { NextRequest, NextResponse } from "next/server";
import preprocessedData from "@/lib/data/preprocessed_data.json";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { video_name, query } = await req.json();
    const cleanQuery = (query || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    const analysisMap = preprocessedData.analysis as Record<string, any>;
    const stem = (video_name || "").replace(/\.[^/.]+$/, "");
    const analysis = analysisMap[video_name] || analysisMap[stem] || { vehicles: [] };

    const matchingVehicles = (analysis.vehicles || []).filter((v: any) => {
      const p = (v.plate || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      return p.includes(cleanQuery);
    });

    return NextResponse.json({
      video_name,
      query,
      cleaned_query: cleanQuery,
      matched: matchingVehicles.length > 0,
      total_matches: matchingVehicles.length,
      matching_vehicles: matchingVehicles,
      primary_match: matchingVehicles[0] || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
