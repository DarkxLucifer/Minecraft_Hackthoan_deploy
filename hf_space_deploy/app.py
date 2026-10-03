"""
VisionX - Indian Automated License Plate Recognition (ALPR) & Surveillance AI
=============================================================================
Runs on Hugging Face Spaces.
Provides:
  1. Gradio Interactive UI for testing on images/videos
  2. FastAPI REST API endpoints (/api/health, /api/anpr/detect) for frontend integration
"""

import io
import os
import re
import base64
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np
import torch
from PIL import Image
import gradio as gr
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ultralytics import YOLO
from transformers import (
    AutoImageProcessor,
    TrOCRProcessor,
    VisionEncoderDecoderModel,
    XLMRobertaTokenizer,
)

# ── Initialize FastAPI Application ──────────────────────────────────────────
fastapi_app = FastAPI(
    title="VisionX AI ANPR Cloud Engine",
    description="Three-Stage YOLO11 + TrOCR Indian License Plate Intelligence Service",
    version="2.0.0",
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load Model Weights ──────────────────────────────────────────────────────
CURRENT_DIR = Path(__file__).resolve().parent
PLATE_WEIGHTS = CURRENT_DIR / "best.pt"
VEHICLE_WEIGHTS = CURRENT_DIR / "yolo11n.pt"
OCR_DIR = CURRENT_DIR / "trocr_indian_plates"
OCR_MODEL_ID = str(OCR_DIR) if (OCR_DIR.exists() and (OCR_DIR / "model.safetensors").exists()) else "microsoft/trocr-small-printed"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 Running on device: {DEVICE}")

# Stage 1: Vehicle Detector
print(f"Loading Vehicle Detector ({VEHICLE_WEIGHTS})...")
vehicle_detector = YOLO(str(VEHICLE_WEIGHTS)) if VEHICLE_WEIGHTS.exists() else None

# Stage 2: Plate Localization
print(f"Loading Plate Detector ({PLATE_WEIGHTS})...")
plate_detector = YOLO(str(PLATE_WEIGHTS)) if PLATE_WEIGHTS.exists() else YOLO("yolo11n.pt")

# Stage 3: TrOCR Character Reader
print(f"Loading TrOCR OCR model ({OCR_MODEL_ID})...")
try:
    processor = TrOCRProcessor.from_pretrained(OCR_MODEL_ID)
except Exception:
    tokenizer = XLMRobertaTokenizer.from_pretrained(OCR_MODEL_ID)
    image_processor = AutoImageProcessor.from_pretrained(OCR_MODEL_ID)
    processor = TrOCRProcessor(image_processor=image_processor, tokenizer=tokenizer)

ocr_model = VisionEncoderDecoderModel.from_pretrained(OCR_MODEL_ID).to(DEVICE)
ocr_model.eval()
print("✅ VisionX AI Models successfully loaded!")

# ── Post-Processing & Indian License Plate Syntax ───────────────────────────
LETTER_TO_DIGIT = {"O": "0", "Q": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "G": "6", "B": "8"}
DIGIT_TO_LETTER = {"0": "O", "1": "I", "8": "B", "5": "S", "6": "G", "2": "Z"}
JUNK_SUFFIXES = ["IND", "INDIA", "VALID", "TEMP", "REGD"]

def normalize_text(text: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(text).upper())

def positional_correct(text: str) -> str:
    t = normalize_text(text)
    if t.startswith("IND") and len(t) > 8:
        t = t[3:]
    for s in JUNK_SUFFIXES:
        if t.endswith(s) and len(t) > len(s) + 5:
            t = t[:-len(s)]

    t = t[:11]
    n = len(t)
    if n < 5:
        return t

    result = list(t)
    for i in range(min(2, n)):
        if result[i] in DIGIT_TO_LETTER:
            result[i] = DIGIT_TO_LETTER[result[i]]

    for i in range(2, min(4, n)):
        if result[i] in LETTER_TO_DIGIT:
            result[i] = LETTER_TO_DIGIT[result[i]]

    trailing_start = 5 if n > 6 else 4
    for i in range(trailing_start, n):
        if result[i] in LETTER_TO_DIGIT:
            result[i] = LETTER_TO_DIGIT[result[i]]

    return "".join(result)

# ── Core Inference Pipeline ─────────────────────────────────────────────────
def run_anpr_inference(img_bgr: np.ndarray):
    orig_h, orig_w = img_bgr.shape[:2]
    annotated = img_bgr.copy()
    vehicles = []
    plates = []

    # 1. Detect vehicles (classes: 2=car, 3=motorcycle, 5=bus, 7=truck)
    if vehicle_detector is not None:
        v_res = vehicle_detector.predict(img_bgr, classes=[2, 3, 5, 7], conf=0.25, imgsz=960, verbose=False)[0]
        if v_res.boxes is not None and len(v_res.boxes) > 0:
            for vb in v_res.boxes:
                vx1, vy1, vx2, vy2 = map(int, vb.xyxy[0])
                conf = float(vb.conf[0])
                cls_id = int(vb.cls[0])
                cls_name = vehicle_detector.names.get(cls_id, "vehicle")
                vehicles.append({
                    "box": [vx1, vy1, vx2, vy2],
                    "confidence": round(conf, 3),
                    "class": cls_name,
                })
                cv2.rectangle(annotated, (vx1, vy1), (vx2, vy2), (255, 180, 0), 2)
                cv2.putText(annotated, f"{cls_name} {conf:.0%}", (vx1 + 4, max(18, vy1 - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 180, 0), 2)

    # 2. Detect plates inside each vehicle
    plate_crops = []
    if vehicles:
        for v in vehicles:
            vx1, vy1, vx2, vy2 = v["box"]
            pad_x = int((vx2 - vx1) * 0.05)
            pad_y = int((vy2 - vy1) * 0.05)
            x1_p, y1_p = max(0, vx1 - pad_x), max(0, vy1 - pad_y)
            x2_p, y2_p = min(orig_w, vx2 + pad_x), min(orig_h, vy2 + pad_y)
            car_crop = img_bgr[y1_p:y2_p, x1_p:x2_p]
            if car_crop.size == 0:
                continue

            p_res = plate_detector.predict(car_crop, conf=0.08, imgsz=640, verbose=False)[0]
            if p_res.boxes is not None:
                for pb in p_res.boxes:
                    px1, py1, px2, py2 = map(int, pb.xyxy[0])
                    pconf = float(pb.conf[0])
                    gx1, gy1 = x1_p + px1, y1_p + py1
                    gx2, gy2 = x1_p + px2, y1_p + py2
                    plate_crops.append(([gx1, gy1, gx2, gy2], pconf, car_crop[py1:py2, px1:px2]))
    else:
        # Fallback: scan whole image for plate
        p_res = plate_detector.predict(img_bgr, conf=0.15, imgsz=960, verbose=False)[0]
        if p_res.boxes is not None:
            for pb in p_res.boxes:
                gx1, gy1, gx2, gy2 = map(int, pb.xyxy[0])
                pconf = float(pb.conf[0])
                crop = img_bgr[max(0, gy1):min(orig_h, gy2), max(0, gx1):min(orig_w, gx2)]
                if crop.size > 0:
                    plate_crops.append(([gx1, gy1, gx2, gy2], pconf, crop))

    # 3. Read plate crops with TrOCR
    for (gx1, gy1, gx2, gy2), pconf, crop in plate_crops:
        if crop.size == 0 or crop.shape[0] < 8 or crop.shape[1] < 16:
            continue

        h, w = crop.shape[:2]
        if h < 64:
            scale = 64 / h
            crop = cv2.resize(crop, (int(w * scale), 64), interpolation=cv2.INTER_CUBIC)

        crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        crop_pil = Image.fromarray(crop_rgb)
        pixel_values = processor(crop_pil, return_tensors="pt").pixel_values.to(DEVICE)

        with torch.no_grad():
            generated_ids = ocr_model.generate(pixel_values, max_new_tokens=15)
        raw_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        plate_text = positional_correct(raw_text)

        plates.append({
            "box": [gx1, gy1, gx2, gy2],
            "confidence": round(pconf, 3),
            "plate_text": plate_text,
            "raw_ocr": raw_text,
        })

        badge = f"{plate_text} ({pconf:.0%})"
        cv2.rectangle(annotated, (gx1, gy1), (gx2, gy2), (0, 255, 64), 3)
        (lw, lh), _ = cv2.getTextSize(badge, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
        cv2.rectangle(annotated, (gx1, max(0, gy1 - lh - 8)), (gx1 + lw + 8, gy1), (0, 255, 64), -1)
        cv2.putText(annotated, badge, (gx1 + 4, gy1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 2)

    return vehicles, plates, annotated

# ── FastAPI REST Endpoints ──────────────────────────────────────────────────
@fastapi_app.get("/api/health")
def api_health():
    return {
        "status": "healthy",
        "service": "VisionX Cloud ANPR Engine",
        "device": DEVICE,
        "models": {
            "vehicle_detector": "yolo11n.pt",
            "plate_detector": "best.pt",
            "ocr": OCR_MODEL_ID,
        }
    }

@fastapi_app.post("/api/anpr/detect")
async def detect_anpr(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    vehicles, plates, annotated = run_anpr_inference(img_bgr)

    # Encode annotated image to JPEG base64
    _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    b64_img = base64.b64encode(buffer).decode("utf-8")

    return {
        "status": "success",
        "vehicle_count": len(vehicles),
        "plate_count": len(plates),
        "vehicles": vehicles,
        "plates": plates,
        "annotated_image": f"data:image/jpeg;base64,{b64_img}",
    }

# ── Gradio Interactive Interface ────────────────────────────────────────────
def gradio_process(image_input):
    if image_input is None:
        return None, "No image provided."

    img_bgr = cv2.cvtColor(np.array(image_input), cv2.COLOR_RGB2BGR)
    vehicles, plates, annotated = run_anpr_inference(img_bgr)
    result_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)

    lines = []
    lines.append(f"🔍 Vehicles Detected: {len(vehicles)}")
    lines.append(f"🏷️ Plates Identified: {len(plates)}")
    lines.append("-" * 36)
    for p in plates:
        lines.append(f"• License Plate: {p['plate_text']} (Confidence: {p['confidence']:.1%})")

    summary = "\n".join(lines) if plates else "No license plates detected in image."
    return result_rgb, summary

with gr.Blocks(title="VisionX - Indian ANPR", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🇮🇳 VisionX — Indian Automated Number Plate Recognition (ANPR)
    **Cloud AI Engine powered by YOLO11 + Microsoft TrOCR (Vision Transformer)**
    - **Frontend App**: Next.js 16 Operator Dashboard
    - **REST API**: `/api/health`, `/api/anpr/detect`
    """)

    with gr.Row():
        with gr.Column():
            input_image = gr.Image(type="pil", label="Upload CCTV / Vehicle Frame")
            btn = gr.Button("⚡ Run 3-Stage ANPR Detection", variant="primary")
        with gr.Column():
            output_image = gr.Image(type="numpy", label="Visual Detection & Bounding Boxes")
            output_text = gr.Textbox(label="Telemetry & Recognized Plates", lines=6)

    btn.click(fn=gradio_process, inputs=input_image, outputs=[output_image, output_text])

# Mount Gradio app onto FastAPI
app = gr.mount_gradio_app(fastapi_app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
