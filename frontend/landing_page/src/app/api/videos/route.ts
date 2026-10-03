import { NextResponse } from "next/server";
import preprocessedData from "@/lib/data/preprocessed_data.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    videos: preprocessedData.videos || [],
  });
}
