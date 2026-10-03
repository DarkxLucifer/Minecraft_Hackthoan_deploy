import { NextRequest, NextResponse } from "next/server";
import preprocessedData from "@/lib/data/preprocessed_data.json";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const validOnly = searchParams.get("valid_only") !== "false";
  const camera = searchParams.get("camera");
  const search = searchParams.get("search")?.toUpperCase().trim();

  const source = validOnly
    ? (preprocessedData.database_valid as any)
    : (preprocessedData.database_all as any);

  let records = [...(source.records || [])];

  if (camera && camera !== "ALL") {
    records = records.filter(
      (r: any) =>
        r.camera_id?.toUpperCase() === camera.toUpperCase() ||
        r.video_name?.toUpperCase().includes(camera.toUpperCase())
    );
  }

  if (search) {
    records = records.filter(
      (r: any) =>
        r.plate?.toUpperCase().includes(search) ||
        r.raw_plate?.toUpperCase().includes(search) ||
        r.state_name?.toUpperCase().includes(search)
    );
  }

  return NextResponse.json({
    total_records: records.length,
    verified_standard_count: records.filter((r: any) => r.is_standard_format).length,
    raw_noise_count: records.filter((r: any) => !r.is_standard_format).length,
    camera_options: source.camera_options || [],
    records,
  });
}
