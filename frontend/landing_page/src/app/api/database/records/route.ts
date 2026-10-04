import { NextRequest, NextResponse } from "next/server";
import preprocessedData from "@/lib/data/preprocessed_data.json";

export const dynamic = "force-dynamic";

function normalizeFuzzyKey(text: string): string {
  const t = (text || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const glyphMap: Record<string, string> = {
    I: "1",
    L: "1",
    O: "0",
    Q: "0",
    D: "0",
    Z: "2",
    S: "5",
    B: "8",
    G: "6",
    U: "V",
  };
  return t
    .split("")
    .map((c) => glyphMap[c] || c)
    .join("");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const validOnly = searchParams.get("valid_only") !== "false";
  const camera = searchParams.get("camera");
  const rawSearch = searchParams.get("search")?.toUpperCase().trim();

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

  if (rawSearch) {
    const fuzzySearch = normalizeFuzzyKey(rawSearch);
    records = records.filter((r: any) => {
      const p = (r.plate || "").toUpperCase();
      const rawP = (r.raw_plate || "").toUpperCase();
      const st = (r.state_name || "").toUpperCase();

      if (p.includes(rawSearch) || rawP.includes(rawSearch) || st.includes(rawSearch)) {
        return true;
      }
      if (normalizeFuzzyKey(p).includes(fuzzySearch) || normalizeFuzzyKey(rawP).includes(fuzzySearch)) {
        return true;
      }
      if (Array.isArray(r.nearby_predictions)) {
        return r.nearby_predictions.some((np: any) => {
          const npStr = (typeof np === "string" ? np : np.plate || "").toUpperCase();
          return npStr.includes(rawSearch) || normalizeFuzzyKey(npStr).includes(fuzzySearch);
        });
      }
      return false;
    });
  }

  return NextResponse.json({
    total_records: records.length,
    verified_standard_count: records.filter((r: any) => r.is_standard_format).length,
    raw_noise_count: records.filter((r: any) => !r.is_standard_format).length,
    camera_options: source.camera_options || [],
    records,
  });
}
