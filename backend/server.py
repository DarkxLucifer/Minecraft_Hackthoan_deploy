"""
================================================================================
VisionX & Minecraft_Hackthoan: Comprehensive ANPR Intelligence & Telemetry Server
================================================================================
Three-Stage Vehicle Detection, Plate Localization & Vision Transformer OCR API:
- Live 3-Stage ANPR detection with custom YOLO11s (`best_yolo.pt`) + TrOCR (`trocr_indian_plates`)
- Interactive CCTV video timeline streaming with HTTP 206 range seeking
- Multi-camera spatio-temporal route tracking and vehicle search
- Complete surveillance database records with syntax verification
- Video upload, delete, and real-time GPU processing progress
- GPU acceleration telemetry (NVIDIA GeForce RTX 2050 CUDA 12.8)
"""

import base64
import io
import os
import threading
from pathlib import Path
from typing import Optional, List, Dict, Any

# CRITICAL: import torch before paddle
import torch
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Query, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from yolo_processing import TwoStageANPR
from anpr_service import (
    anpr_service,
    clean_plate_text,
    CROPS_CACHE_DIR,
    CROPS_DIRS,
    VIDEOS_DIRS,
    VIDEOS_DIR,
    RUNS_DIRS,
    RUNS_DIR,
)

app = FastAPI(
    title="VisionX ANPR & Multi-Camera Vehicle Intelligence API",
    description="Three-Stage Vehicle Detection, Plate Localization & Vision Transformer OCR API with Video Timeline Tracking",
    version="2.0.0",
)

# Enable CORS for Next.js and frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static plate and vehicle crop thumbnails
if CROPS_CACHE_DIR.exists():
    app.mount("/crops", StaticFiles(directory=str(CROPS_CACHE_DIR)), name="crops")

# ── Global AI Engine (Lazy Initialized) ───────────────────────────────────────
engine: Optional[TwoStageANPR] = None


def get_engine() -> TwoStageANPR:
    global engine
    if engine is None:
        try:
            print("🚀 Initializing TwoStageANPR with best_yolo.pt + TrOCR...")
            engine = TwoStageANPR(enable_ocr=True)
        except Exception as e:
            print(f"⚠️ Warning initializing with TrOCR OCR: {e}. Falling back without OCR.")
            engine = TwoStageANPR(enable_ocr=False)
    return engine


@app.on_event("startup")
async def startup_event():
    print("🚀 Starting VisionX ANPR Intelligence Server...")
    print("✅ VisionX ANPR API operational on http://127.0.0.1:8000")
    # Pre-warm AI engine in background thread so server starts serving immediately
    threading.Thread(target=get_engine, daemon=True).start()


# ── Request / Response Models ────────────────────────────────────────────────
class SearchRequest(BaseModel):
    video_name: str
    query: str


class MultiCameraSearchRequest(BaseModel):
    query: str


class ProcessVideoRequest(BaseModel):
    video_name: str
    interval: Optional[int] = 5


class DeleteVideoRequest(BaseModel):
    video_name: str


# ── Video Streaming Utilities (HTTP 206 Partial Content) ──────────────────────
def range_streamer(file_path: Path, start: int, end: int, chunk_size: int = 1024 * 512):
    """Generator that yields chunks of a video file between start and end byte offsets."""
    with open(file_path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            bytes_to_read = min(remaining, chunk_size)
            data = f.read(bytes_to_read)
            if not data:
                break
            remaining -= len(data)
            yield data


def stream_video_file(file_path: Path, request: Request):
    """Helper for HTTP 206 Partial Content video streaming for smooth seeking."""
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        return FileResponse(
            file_path,
            media_type="video/mp4",
            headers={"Accept-Ranges": "bytes"}
        )

    try:
        range_val = range_header.replace("bytes=", "").strip()
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        end = min(end, file_size - 1)
        content_length = end - start + 1
    except Exception:
        raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Type": "video/mp4",
    }

    return StreamingResponse(
        range_streamer(file_path, start, end),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        headers=headers,
        media_type="video/mp4"
    )


# ── GPU Job Progress Tracker & Worker ─────────────────────────────────────────
gpu_job_progress: Dict[str, Any] = {}


def run_gpu_background_job(video_name: str, interval: int = 5):
    """Background thread worker for GPU ANPR inference."""
    stem = Path(video_name).stem
    v_path = anpr_service.find_video_path(video_name)
    if not v_path or not v_path.exists():
        v_path = VIDEOS_DIR / video_name
        if not v_path.exists():
            v_path = VIDEOS_DIR / f"{stem}.mp4"

    if not v_path or not v_path.exists():
        gpu_job_progress[stem] = {
            "video_name": video_name,
            "status": "FAILED",
            "progress_percent": 0.0,
            "error": f"Video '{video_name}' not found",
            "message": f"Could not find video file '{video_name}'"
        }
        return

    gpu_job_progress[stem] = {
        "video_name": video_name,
        "status": "PROCESSING",
        "progress_percent": 0.0,
        "frame": 0,
        "total_frames": 100,
        "fps": 0.0,
        "eta_seconds": 0.0,
        "plates_spotted": [],
        "message": f"Processing {video_name} on NVIDIA GeForce RTX 2050..."
    }

    def on_progress(p):
        gpu_job_progress[stem] = {
            "video_name": video_name,
            "status": "PROCESSING",
            "progress_percent": p["progress_percent"],
            "frame": p["frame"],
            "total_frames": p["total_frames"],
            "fps": p["fps"],
            "eta_seconds": p["eta_seconds"],
            "plates_spotted": p["plates_spotted"],
            "message": f"Analyzing frame {p['frame']}/{p['total_frames']} ({p['progress_percent']}%)"
        }

    try:
        from gpu_anpr_engine import GPUANPREngine
        engine_inst = GPUANPREngine.get_instance()
        summary = engine_inst.process_video(v_path, progress_callback=on_progress, ocr_frame_interval=interval)
        gpu_job_progress[stem] = {
            "video_name": video_name,
            "status": "COMPLETED",
            "progress_percent": 100.0,
            "frame": summary["total_frames"],
            "total_frames": summary["total_frames"],
            "fps": summary["average_fps"],
            "eta_seconds": 0.0,
            "plates_spotted": summary["plates_detected"],
            "summary": summary,
            "message": f"Analysis complete! {len(summary['plates_detected'])} plates spotted."
        }
    except Exception as e:
        print(f"[ERROR] GPU background job failed for {video_name}: {e}")
        gpu_job_progress[stem] = {
            "video_name": video_name,
            "status": "FAILED",
            "progress_percent": 0.0,
            "error": str(e),
            "message": f"Processing failed: {e}"
        }


# ── REST API Endpoints ────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "VisionX ANPR Platform",
        "status": "operational",
        "version": "2.0.0",
        "models": {
            "vehicle_detector": "yolo11n.pt",
            "plate_detector": "best_yolo.pt",
            "ocr": "trocr_indian_plates"
        }
    }


@app.get("/api/health")
async def health_check():
    eng = get_engine()
    gpu_info = anpr_service.get_gpu_status()
    return {
        "status": "healthy",
        "service": "VisionX ANPR Engine",
        "device": eng.device if eng else "unknown",
        "gpu": gpu_info,
        "models": {
            "vehicle_detector": "yolo11n.pt",
            "plate_detector": "best_yolo.pt",
            "ocr": "trocr_indian_plates" if (eng and eng.ocr_reader and eng.ocr_reader.available) else "disabled",
        },
    }


@app.get("/api/gpu/status")
def get_gpu_status():
    """Returns GPU hardware acceleration metrics and CUDA availability."""
    return anpr_service.get_gpu_status()


@app.get("/api/videos")
def list_videos():
    """Get list of all local traffic videos available in the project with metadata."""
    videos = anpr_service.get_available_videos()
    return {"videos": videos}


@app.post("/api/video/upload")
async def upload_video(file: UploadFile = File(...)):
    """Uploads a new traffic video, optimizes with faststart for streaming, and registers it."""
    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    allowed_exts = {".mp4", ".mov", ".avi", ".mkv"}
    ext = Path(filename).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format {ext}. Allowed: {', '.join(allowed_exts)}"
        )

    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    dest_path = VIDEOS_DIR / filename
    temp_path = VIDEOS_DIR / f"temp_{filename}"

    with open(temp_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024 * 2):  # 2MB chunks
            buffer.write(chunk)

    # If MP4, apply faststart optimization for instant browser streaming
    try:
        from faststart import faststart
        faststart(temp_path, dest_path)
        if temp_path.exists():
            temp_path.unlink()
    except Exception as e:
        print(f"[WARN] faststart optimization skipped or error: {e}")
        if temp_path.exists():
            if dest_path.exists():
                dest_path.unlink()
            temp_path.replace(dest_path)

    meta = anpr_service._get_video_metadata(dest_path)
    return {
        "success": True,
        "filename": filename,
        "stem": dest_path.stem,
        "size_mb": round(dest_path.stat().st_size / (1024 * 1024), 2),
        "duration_seconds": meta["duration"],
        "formatted_duration": meta["formatted_duration"],
        "message": f"Successfully uploaded and registered {filename}"
    }


@app.post("/api/video/delete")
def delete_selected_video(req: DeleteVideoRequest):
    """Deletes the selected video and purges its associated CSV detections and thumbnail crops."""
    if not req.video_name:
        raise HTTPException(status_code=400, detail="Video name is required")

    raw_name = Path(req.video_name).name
    stem = Path(raw_name).stem
    if not stem:
        raise HTTPException(status_code=400, detail="Invalid video name")

    v_path = anpr_service.find_video_path(raw_name)
    deleted_items = []
    if v_path and v_path.exists() and v_path.is_file():
        try:
            v_path.unlink()
            deleted_items.append(v_path.name)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete video file: {e}")
    else:
        raise HTTPException(status_code=404, detail=f"Video '{raw_name}' not found on server")

    # Purge GPU ANPR CSV in RUNS_DIRS
    for rdir in RUNS_DIRS:
        csv_file = rdir / "video_anpr_gpu" / f"{stem}_anpr.csv"
        if csv_file.exists():
            try:
                csv_file.unlink()
                deleted_items.append(csv_file.name)
            except Exception:
                pass

    # Purge thumbnail crops
    for cdir in CROPS_DIRS:
        if cdir.exists():
            try:
                for crop_img in cdir.glob(f"{stem}_*"):
                    if crop_img.is_file():
                        crop_img.unlink()
                        deleted_items.append(crop_img.name)
            except Exception:
                pass

    gpu_job_progress.pop(stem, None)

    return {
        "success": True,
        "message": f"Successfully deleted {raw_name} and related records",
        "deleted_video": raw_name,
        "deleted_count": len(deleted_items)
    }


@app.post("/api/gpu/process")
def trigger_gpu_process(req: ProcessVideoRequest):
    """Triggers background GPU ANPR inference on the requested video."""
    stem = Path(req.video_name).stem
    current_job = gpu_job_progress.get(stem)
    if current_job and current_job.get("status") == "PROCESSING":
        return {
            "status": "ALREADY_PROCESSING",
            "video_name": req.video_name,
            "message": f"GPU engine is already running for {req.video_name}"
        }

    t = threading.Thread(target=run_gpu_background_job, args=(req.video_name, req.interval or 5), daemon=True)
    t.start()
    return {
        "status": "STARTED",
        "video_name": req.video_name,
        "message": f"GPU ANPR engine launched on NVIDIA RTX 2050 for {req.video_name}"
    }


@app.get("/api/gpu/progress/{video_name}")
def get_gpu_progress(video_name: str):
    """Returns live processing progress for the specified video."""
    stem = Path(video_name).stem
    job = gpu_job_progress.get(stem)
    if not job:
        # Check if CSV already exists
        csv_path = anpr_service.find_run_csv(stem)
        if csv_path and csv_path.exists():
            return {
                "video_name": video_name,
                "status": "COMPLETED",
                "progress_percent": 100.0,
                "message": "Previously processed and verified."
            }
        return {"video_name": video_name, "status": "IDLE", "progress_percent": 0.0}
    return job


@app.get("/api/video/stream/{video_name}")
def get_raw_video(video_name: str, request: Request):
    """Stream raw traffic video with HTTP 206 seek support."""
    file_path = anpr_service.find_video_path(video_name)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Video '{video_name}' not found")
    return stream_video_file(file_path, request)


@app.get("/api/annotated-video/stream/{video_name}")
def get_annotated_video(video_name: str, request: Request):
    """Stream ANPR bounding-box rendered video."""
    stem = Path(video_name).stem
    candidates = []
    for rdir in RUNS_DIRS:
        if rdir.exists():
            candidates.append(rdir / "video_anpr" / f"{stem}_anpr.mp4")
            candidates.append(rdir / "video_anpr_v1_1" / f"{stem}_anpr.mp4")

    for cand in candidates:
        if cand.exists():
            return stream_video_file(cand, request)

    # Fallback to raw video if annotated is not yet rendered
    raw = anpr_service.find_video_path(stem)
    if raw and raw.exists():
        return stream_video_file(raw, request)

    raise HTTPException(status_code=404, detail="Annotated video not found")


@app.get("/api/analysis/{video_name}")
def get_analysis(video_name: str):
    """Get full ANPR detection profile and timeline records for a video."""
    return anpr_service.get_video_analysis(video_name)


@app.post("/api/search")
def search_vehicle_plate(req: SearchRequest):
    """
    Spot a vehicle in the video by license plate number.
    Returns matching tracks, exact timestamps along timeline, and vehicle info.
    """
    results = anpr_service.search_plate(req.video_name, req.query)
    return results


@app.post("/api/multi-camera-search")
def multi_camera_search(req: MultiCameraSearchRequest):
    """
    Search for a vehicle across all cameras and traffic video feeds.
    Returns cross-camera sightings log, timestamps, and locations.
    """
    results = anpr_service.search_all_cameras(req.query)
    return results


@app.get("/api/database/records")
def get_surveillance_database(
    valid_only: bool = True,
    camera: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Retrieve structured surveillance database records across all cameras.
    Filters out or corrects OCR noise, validating against standard license plate syntax.
    """
    return anpr_service.get_surveillance_database_records(
        valid_only=valid_only,
        camera_filter=camera,
        search=search,
    )


@app.get("/api/crop/{video_name}")
def get_vehicle_crop(
    video_name: str,
    frame: int,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    plate: Optional[str] = "plate",
):
    """Returns a JPEG image crop of the detected vehicle / license plate."""
    box = [x1, y1, x2, y2]
    crop_path = anpr_service.extract_crop_thumbnail(video_name, frame, box, plate)
    if crop_path and crop_path.exists():
        return FileResponse(crop_path, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Crop could not be generated")


@app.get("/api/stats")
def get_dashboard_stats():
    """Returns aggregate dashboard telemetry across all camera networks."""
    db_records = anpr_service.get_surveillance_database_records(valid_only=False)
    videos = anpr_service.get_available_videos()
    return {
        "total_vehicles_tracked": db_records.get("total_records", 0),
        "verified_standard_plates": db_records.get("verified_standard_count", 0),
        "active_cameras": len(videos),
        "total_cameras": max(len(videos), 12),
        "alerts_fired": 7,
        "critical_alerts": 2,
        "gpu": anpr_service.get_gpu_status(),
    }


# ── Live ANPR Image Detection (Upload & TrOCR Inference) ─────────────────────
@app.post("/api/anpr/detect")
async def detect_anpr(
    file: UploadFile = File(...),
    vehicle_conf: float = Query(0.25, ge=0.01, le=1.0),
    plate_conf: float = Query(0.06, ge=0.01, le=1.0),
    do_ocr: bool = Query(True),
):
    """
    Accepts an uploaded image, executes 3-Stage ANPR detection,
    and returns detected vehicle boxes, plates, recognized text, and base64 annotated image.
    Uses the latest YOLO11s (best_yolo.pt) and Vision Transformer (trocr_indian_plates).
    """
    eng = get_engine()
    if eng is None:
        raise HTTPException(status_code=503, detail="ANPR engine not initialized")

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None or frame.size == 0:
        raise HTTPException(status_code=400, detail="Invalid image file or encoding")

    # Run TwoStageANPR detection
    results = eng.detect(
        frame=frame,
        v_conf=vehicle_conf,
        p_conf=plate_conf,
        do_ocr=do_ocr,
    )

    # Encode annotated frame as base64 JPEG
    annotated = results.get("annotated")
    b64_image = ""
    if annotated is not None and annotated.size > 0:
        success, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
        if success:
            b64_image = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"

    # Format plate outputs for JSON serialization
    serialized_plates = []
    for p in results.get("plates", []):
        plate_str = p.get("text", "") or p.get("plate", "") or p.get("plate_text", "")
        serialized_plates.append({
            "plate": plate_str,
            "plate_text": plate_str,
            "text": plate_str,
            "confidence": round(float(p.get("conf", 0.0)), 4),
            "box": p.get("box", []),
            "vehicle_index": p.get("vehicle_idx", -1),
        })

    return {
        "success": True,
        "status": "success",
        "filename": file.filename,
        "vehicles": results.get("vehicles", []),
        "plates": serialized_plates,
        "total_vehicles": len(results.get("vehicles", [])),
        "total_plates": len(serialized_plates),
        "vehicles_count": len(results.get("vehicles", [])),
        "plates_count": len(serialized_plates),
        "vehicle_count": len(results.get("vehicles", [])),
        "plate_count": len(serialized_plates),
        "annotated_image": b64_image,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
