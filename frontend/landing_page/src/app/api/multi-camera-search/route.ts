import { NextRequest, NextResponse } from "next/server";
import preprocessedData from "@/lib/data/preprocessed_data.json";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    const cleanQuery = (query || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    const analysisMap = preprocessedData.analysis as Record<string, any>;
    const videos = preprocessedData.videos || [];
    const sightings: any[] = [];

    const CAM_MAP: Record<string, any> = {
      "1": { id: "CAM-01", location: "Main Junction - North Approach", zone: "Zone A" },
      "2": { id: "CAM-02", location: "East Expressway - Toll Plaza", zone: "Zone B" },
      "4": { id: "CAM-04", location: "South Boulevard - Ring Intersection", zone: "Zone C" },
      "crash": { id: "CAM-CRASH", location: "Outer Highway Incident Unit", zone: "Zone D" },
      "toll": { id: "CAM-TOLL", location: "Interstate Toll Plaza", zone: "Zone E" },
    };

    for (const v of videos) {
      const stem = v.stem;
      const ana = analysisMap[stem];
      if (!ana || !ana.vehicles) continue;

      const camInfo = CAM_MAP[stem] || {
        id: `CAM-${stem.toUpperCase()}`,
        location: `Feed ${stem} Surveillance`,
        zone: "Zone Arterial",
      };

      for (const veh of ana.vehicles) {
        const p = (veh.plate || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        if (p.includes(cleanQuery)) {
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
          });
          break;
        }
      }
    }

    sightings.sort((a, b) => a.camera_id.localeCompare(b.camera_id));

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
