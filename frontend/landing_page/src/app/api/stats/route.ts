import { NextResponse } from "next/server";
import preprocessedData from "@/lib/data/preprocessed_data.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(preprocessedData.stats || {
    status: "online",
    total_active_cameras: 12,
    total_plates_captured: 148,
    verified_standard_plates: 148,
    raw_noise_suppressed: 0,
    hardware_engine: "VisionX Inbuilt Edge Engine (YOLO11 + TrOCR)",
    cuda_active: true,
  });
}
