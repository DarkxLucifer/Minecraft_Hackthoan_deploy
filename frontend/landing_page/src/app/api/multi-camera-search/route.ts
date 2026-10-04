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

function calculatePlateSimilarity(p1: string, p2: string): number {
  const s1 = (p1 || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const s2 = (p2 || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  const k1 = normalizeFuzzyKey(s1);
  const k2 = normalizeFuzzyKey(s2);
  if (k1 === k2) return 0.98;
  if (k1.includes(k2) || k2.includes(k1)) return 0.94;
  if (s1.includes(s2) || s2.includes(s1)) return 0.90;

  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c1 = s1[i - 1];
      const c2 = s2[j - 1];
      let cost = 1.0;
      if (c1 === c2) {
        cost = 0;
      } else if (normalizeFuzzyKey(c1) === normalizeFuzzyKey(c2)) {
        cost = 0.2;
      }
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  const dist = dp[m][n];
  const maxLen = Math.max(m, n);
  return Math.max(0, 1.0 - dist / maxLen);
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    const cleanQuery = (query || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    const analysisMap = preprocessedData.analysis as Record<string, any>;
    const videos = preprocessedData.videos || [];
    const sightings: any[] = [];

    const CAM_MAP: Record<string, any> = {
      "15698741_2160_3840_30fps": { id: "CAM-07", location: "Highway Perimeter Gantry", zone: "Zone Arterial Highway" },
      "1": { id: "CAM-01", location: "Main Junction - North Approach", zone: "Zone A" },
      "2": { id: "CAM-02", location: "East Expressway - Toll Plaza", zone: "Zone B" },
      "4": { id: "CAM-04", location: "South Boulevard - Ring Intersection", zone: "Zone C" },
      "crash": { id: "CAM-CRASH", location: "Outer Highway Incident Unit", zone: "Zone D" },
      "toll": { id: "CAM-TOLL", location: "Interstate Toll Plaza", zone: "Zone E" },
    };

    for (const v of videos) {
      const stem = v.stem;
      const ana = analysisMap[stem] || analysisMap[v.filename];
      if (!ana || !ana.vehicles) continue;

      const camInfo = CAM_MAP[stem] || {
        id: `CAM-${stem.toUpperCase().slice(0, 8)}`,
        location: `Feed ${stem} Surveillance`,
        zone: "Zone Arterial",
      };

      for (const veh of ana.vehicles) {
        const p = (veh.plate || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        let sim = calculatePlateSimilarity(cleanQuery, p);

        const nearbyList = (veh.nearby_predictions || []).map((np: any) =>
          typeof np === "string" ? np : np.plate
        );
        for (const npPlate of nearbyList) {
          const npSim = calculatePlateSimilarity(cleanQuery, npPlate);
          if (npSim > sim) {
            sim = npSim;
          }
        }

        if (sim >= 0.70 || p.includes(cleanQuery) || cleanQuery.includes(p)) {
          const isExact = p === cleanQuery;
          sightings.push({
            camera_id: camInfo.id,
            camera_name: camInfo.location,
            camera_zone: camInfo.zone,
            video_name: v.filename,
            video_stem: stem,
            plate: veh.plate,
            state: veh.state,
            first_seen: veh.first_seen,
            last_seen: veh.last_seen,
            formatted_first_seen: veh.formatted_first_seen,
            formatted_last_seen: veh.formatted_last_seen,
            total_sightings: veh.total_occurrences,
            best_ocr_confidence: veh.best_ocr_confidence,
            best_detector_confidence: veh.best_detector_confidence,
            best_frame: veh.best_frame,
            best_box: veh.best_box,
            timeline_markers: veh.timeline_markers,
            is_exact_match: isExact,
            is_nearby_match: !isExact,
            match_type: isExact ? "EXACT" : "NEARBY_NUMBER_PREDICTION",
            similarity_score: Math.round(sim * 100) / 100,
          });
          break;
        }
      }
    }

    sightings.sort((a, b) => {
      if (a.is_exact_match && !b.is_exact_match) return -1;
      if (!a.is_exact_match && b.is_exact_match) return 1;
      return a.camera_id.localeCompare(b.camera_id);
    });

    return NextResponse.json({
      query,
      cleaned_query: cleanQuery,
      matched: sightings.length > 0,
      cameras_detected_in: sightings.length,
      total_cameras_scanned: videos.length,
      sightings,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
