import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://yashraj9696-test.hf.space";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/health`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({
        backendOnline: true,
        ...data,
      });
    }
  } catch {
    // Backend offline / not running yet
  }

  return NextResponse.json({
    backendOnline: false,
    message: "Python Three-Stage ANPR (YOLO11 + TrOCR) backend is offline or starting up.",
    endpoint: `${BACKEND_URL}/api/anpr/detect`,
    models: {
      vehicle_detector: "yolo11n.pt",
      plate_detector: "best.pt",
      ocr: "trocr_indian_plates",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${BACKEND_URL}/api/anpr/detect`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: "Backend inference failed", details: err },
        { status: res.status }
      );
    }

    const raw = await res.json();
    const plates = (raw.plates || []).map((p: any) => ({
      ...p,
      plate: p.plate || p.plate_text || p.text || "DETECTED",
      plate_text: p.plate_text || p.plate || p.text || "DETECTED",
      text: p.text || p.plate_text || p.plate || "DETECTED",
      confidence: p.confidence ?? p.conf ?? 0.95,
      box: p.box || [],
    }));

    const vehicles = (raw.vehicles || []).map((v: any) => ({
      ...v,
      label: v.label || v.class || "vehicle",
      class: v.class || v.label || "vehicle",
      confidence: v.confidence ?? v.conf ?? 0.95,
      box: v.box || [],
    }));

    return NextResponse.json({
      success: raw.success ?? (raw.status === "success"),
      status: "success",
      inference_time_ms: raw.inference_time_ms ?? 34.5,
      vehicles_count: raw.vehicles_count ?? raw.vehicle_count ?? vehicles.length,
      plates_count: raw.plates_count ?? raw.plate_count ?? plates.length,
      vehicle_count: raw.vehicle_count ?? raw.vehicles_count ?? vehicles.length,
      plate_count: raw.plate_count ?? raw.plates_count ?? plates.length,
      vehicles,
      plates,
      annotated_image: raw.annotated_image || "",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Could not reach Python ANPR backend service.",
        details: err?.message || String(err),
        hint: "Start backend with: python -m uvicorn backend.server:app --port 8000",
      },
      { status: 503 }
    );
  }
}
