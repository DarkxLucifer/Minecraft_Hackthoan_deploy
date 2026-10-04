"""
================================================================================
Vision X / Minecraft_Hackthoan: End-to-End ANPR Processing Engine
================================================================================
Three-Stage Architecture:
  1. Stage 1 (Vehicle Detection): yolo11n.pt (cars, buses, trucks, motorcycles)
  2. Stage 2 (Plate Localization): best.pt (fine-tuned YOLO license plate model)
  3. Stage 3 (Character Recognition): TrOCR (Vision Transformer for Indian plates)

Features:
  - Multi-car parallel detection
  - Low-contrast / Trade Certificate (Red) plate recovery
  - Fully local, offline Transformer OCR (TrOCR) character reading
  - Indian license plate positional syntax correction
  - Real-time video & image processing APIs
"""

import os
import re
from pathlib import Path
import cv2
import numpy as np
import torch
from PIL import Image
from ultralytics import YOLO

CURRENT_DIR = Path(__file__).resolve().parent

# ── Indian Plate Post-Processing & Text Cleaning ─────────────────────────────
LETTER_TO_DIGIT = {"O": "0", "Q": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "G": "6", "B": "8"}
DIGIT_TO_LETTER = {"0": "O", "1": "I", "8": "B", "5": "S", "6": "G", "2": "Z"}
JUNK_SUFFIXES = ["IND", "INDIA", "VALID", "TEMP", "REGD"]

def normalize_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"[^A-Z0-9]", "", str(text).upper())

def strip_junk(text: str) -> str:
    t = normalize_text(text)
    if t.startswith("IND") and len(t) > 8:
        t = t[3:]
    for s in JUNK_SUFFIXES:
        if t.endswith(s) and len(t) > len(s) + 5:
            t = t[:-len(s)]
    return t[:11]

INDIAN_STATES = {
    "AN": "Andaman and Nicobar", "AP": "Andhra Pradesh", "AR": "Arunachal Pradesh",
    "AS": "Assam", "BR": "Bihar", "CG": "Chhattisgarh", "CH": "Chandigarh",
    "DD": "Daman and Diu", "DL": "Delhi", "DN": "Dadra and Nagar Haveli",
    "GA": "Goa", "GJ": "Gujarat", "HP": "Himachal Pradesh", "HR": "Haryana",
    "JH": "Jharkhand", "JK": "Jammu and Kashmir", "KA": "Karnataka",
    "KL": "Kerala", "LA": "Ladakh", "LD": "Lakshadweep", "MH": "Maharashtra",
    "ML": "Meghalaya", "MN": "Manipur", "MP": "Madhya Pradesh", "MZ": "Mizoram",
    "NL": "Nagaland", "OD": "Odisha", "PB": "Punjab", "PY": "Puducherry",
    "RJ": "Rajasthan", "SK": "Sikkim", "TN": "Tamil Nadu", "TR": "Tripura",
    "TS": "Telangana", "UK": "Uttarakhand", "UP": "Uttar Pradesh", "WB": "West Bengal",
    "BH": "Bharat Series",
}

STATE_CONFUSIONS = {
    "0L": "DL", "OL": "DL", "D1": "DL", "K4": "KA", "1H": "JH", "M8": "MH",
    "0D": "OD", "U0": "UP", "K1": "KL", "T5": "TS", "B8": "BR", "P8": "PB",
    "H8": "HR", "N1": "NL", "G1": "GJ", "R1": "RJ", "A5": "AS", "T1": "TN",
}

def positional_correct(text: str) -> str:
    """
    Standard Indian License Plate Format:
    - 2 Letters (State Code: DL, MH, TN, KA, etc.)
    - 2 Digits (RTO Code: 01 - 99)
    - 1-3 Letters (Series)
    - 4 Digits (Unique registration number: 0001 - 9999)
    """
    t = strip_junk(text)
    n = len(t)
    if n < 5:
        return t

    result = list(t)

    # First 2 characters: State Code (check confusions or map digits to letters)
    prefix2 = "".join(result[:2])
    if prefix2 in STATE_CONFUSIONS:
        result[0], result[1] = STATE_CONFUSIONS[prefix2][0], STATE_CONFUSIONS[prefix2][1]
    else:
        for i in range(min(2, n)):
            if result[i] in DIGIT_TO_LETTER:
                result[i] = DIGIT_TO_LETTER[result[i]]

    # Next 2 characters: RTO code (must be digits)
    for i in range(2, min(4, n)):
        if result[i] in LETTER_TO_DIGIT:
            result[i] = LETTER_TO_DIGIT[result[i]]

    # Dynamically find trailing digit group
    trailing_start = n
    i = n - 1
    while i >= 4:
        c = result[i]
        if c.isdigit() or (c.isalpha() and c in LETTER_TO_DIGIT):
            trailing_start = i
            i -= 1
        else:
            break

    dlen = n - trailing_start
    if dlen > 4:
        trailing_start = n - 4
    elif dlen < 1:
        trailing_start = n

    # Characters between RTO code and trailing digits should be letters
    for i in range(4, trailing_start):
        if result[i] in DIGIT_TO_LETTER:
            result[i] = DIGIT_TO_LETTER[result[i]]

    # Trailing characters must be digits
    for i in range(trailing_start, n):
        if result[i] in LETTER_TO_DIGIT:
            result[i] = LETTER_TO_DIGIT[result[i]]

    return "".join(result)


# ── Stage 3: Transformer OCR (TrOCR) Engine ─────────────────────────────────
class TrOCRPlateReader:
    """
    High-accuracy Vision Transformer OCR using fine-tuned DeiT + TrOCR weights.
    Runs 100% locally and offline without external API dependencies.
    """
    def __init__(self, model_path=None, device=None):
        if model_path is None:
            candidates = [
                CURRENT_DIR / "models" / "trocr_indian_plates",
                CURRENT_DIR.parent / "models" / "trocr_indian_plates",
                Path(r"D:\project\aiml prime\project\traffic-light\models\trocr_indian_plates"),
            ]
            model_path = next((p for p in candidates if p.exists()), None)

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.available = False

        if model_path and model_path.exists():
            try:
                from transformers import TrOCRProcessor, VisionEncoderDecoderModel
                print(f"Loading TrOCR Model from: {model_path} on {self.device}...")
                self.processor = TrOCRProcessor.from_pretrained(str(model_path))
                self.model = VisionEncoderDecoderModel.from_pretrained(str(model_path)).to(self.device)
                self.model.eval()
                self.available = True
                print("✅ TrOCR Indian Plate Reader ready!")
            except Exception as e:
                print(f"⚠️ TrOCR load notice: {e}")
        else:
            print("⚠️ TrOCR model folder not found. OCR reading will be skipped.")

    def read(self, crop_bgr: np.ndarray, min_height=64) -> str:
        if not self.available or crop_bgr is None or crop_bgr.size == 0:
            return ""

        h, w = crop_bgr.shape[:2]
        if h < 10 or w < 20:
            return ""

        # Resize small crops for transformer receptive field
        if h < min_height:
            scale = min_height / h
            crop_bgr = cv2.resize(
                crop_bgr,
                (int(w * scale), min_height),
                interpolation=cv2.INTER_CUBIC,
            )

        # Contrast enhancement using CLAHE in LAB color space
        try:
            lab = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2LAB)
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(4, 4))
            lab[:, :, 0] = clahe.apply(lab[:, :, 0])
            crop_bgr = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        except Exception:
            pass

        # Convert to PIL RGB
        crop_rgb = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(crop_rgb)

        try:
            pixel_values = self.processor(images=pil_img, return_tensors="pt").pixel_values.to(self.device)
            with torch.no_grad():
                generated_ids = self.model.generate(
                    pixel_values,
                    max_new_tokens=16,
                    num_beams=3,
                    early_stopping=True,
                )
            raw_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            clean_text = positional_correct(raw_text)
            return clean_text
        except Exception as e:
            return ""


# ── Full Two-Stage + TrOCR ANPR Pipeline ─────────────────────────────────────
class TwoStageANPR:
    def __init__(self, vehicle_weights=None, plate_weights=None, trocr_path=None, enable_ocr=True, device=None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        # Resolve vehicle model
        if vehicle_weights is None:
            candidates = [
                CURRENT_DIR / "models" / "yolo11n.pt",
                CURRENT_DIR / "yolo11n.pt",
                "yolo11n.pt"
            ]
            vehicle_weights = next((str(p) for p in candidates if Path(p).exists()), "yolo11n.pt")

        # Resolve plate model
        if plate_weights is None:
            candidates = [
                CURRENT_DIR / "models" / "best_yolo.pt",
                Path(r"C:\Users\yashr\Downloads\best_yolo.pt"),
                CURRENT_DIR / "models" / "best.pt",
                CURRENT_DIR / "best.pt",
                "best.pt"
            ]
            plate_weights = next((str(p) for p in candidates if Path(p).exists()), "best_yolo.pt")

        print(f"Loading Stage 1 Vehicle Detector from: {vehicle_weights}...")
        self.vehicle_model = YOLO(str(vehicle_weights))

        print(f"Loading Stage 2 Plate Detector from  : {plate_weights}...")
        self.plate_model = YOLO(str(plate_weights))

        # Resolve TrOCR Model
        self.ocr_reader = None
        if enable_ocr:
            self.ocr_reader = TrOCRPlateReader(model_path=trocr_path, device=self.device)

        print("✅ TwoStageANPR Engine successfully initialized with TrOCR!")

    def detect(self, frame, v_conf=0.25, p_conf=0.06, imgsz=960, padding_pct=0.05, do_ocr=True):
        """
        Runs Vehicle-First detection + Plate Localization + TrOCR reading.

        Returns:
            dict containing:
                - 'vehicles': list of detected vehicles
                - 'plates': list of detected license plates (with crop, box, and recognized text)
                - 'annotated': rendered frame with bounding boxes and text badges
        """
        if frame is None or frame.size == 0:
            return {"vehicles": [], "plates": [], "annotated": frame}

        orig_h, orig_w = frame.shape[:2]
        annotated = frame.copy()

        # Step 1: Detect vehicles (COCO IDs: 2=car, 3=motorcycle, 5=bus, 7=truck)
        v_res = self.vehicle_model.predict(
            frame,
            classes=[2, 3, 5, 7],
            conf=v_conf,
            imgsz=imgsz,
            device=self.device,
            verbose=False
        )[0]

        vehicles = []
        if v_res.boxes is not None and len(v_res.boxes) > 0:
            for vb in v_res.boxes:
                vx1, vy1, vx2, vy2 = map(int, vb.xyxy[0])
                vconf = float(vb.conf[0])
                vcls = int(vb.cls[0])
                vlabel = self.vehicle_model.names[vcls]
                vehicles.append({
                    "box": [vx1, vy1, vx2, vy2],
                    "conf": vconf,
                    "label": vlabel
                })

        plates = []

        # Step 2: Plate detection inside each vehicle crop
        if vehicles:
            for v_idx, v in enumerate(vehicles):
                vx1, vy1, vx2, vy2 = v["box"]
                vlabel = v["label"]
                vconf = v["conf"]

                # Draw vehicle box (Cyan / Orange)
                cv2.rectangle(annotated, (vx1, vy1), (vx2, vy2), (255, 180, 0), 2)
                v_tag = f"{vlabel} {vconf:.0%}"
                cv2.putText(annotated, v_tag, (vx1 + 4, vy1 + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 180, 0), 2)

                # Add padding around vehicle crop
                pad_x = int((vx2 - vx1) * padding_pct)
                pad_y = int((vy2 - vy1) * padding_pct)
                x1_p, y1_p = max(0, vx1 - pad_x), max(0, vy1 - pad_y)
                x2_p, y2_p = min(orig_w, vx2 + pad_x), min(orig_h, vy2 + pad_y)

                car_crop = frame[y1_p:y2_p, x1_p:x2_p]
                if car_crop.size == 0:
                    continue

                p_res = self.plate_model.predict(
                    car_crop,
                    conf=p_conf,
                    imgsz=640,
                    device=self.device,
                    verbose=False
                )[0]

                if p_res.boxes is not None and len(p_res.boxes) > 0:
                    for pb in p_res.boxes:
                        px1, py1, px2, py2 = map(int, pb.xyxy[0])
                        pconf = float(pb.conf[0])

                        gx1 = x1_p + px1
                        gy1 = y1_p + py1
                        gx2 = x1_p + px2
                        gy2 = y1_p + py2

                        plate_crop = car_crop[py1:py2, px1:px2]

                        # Step 3: Run TrOCR on plate crop
                        plate_text = ""
                        if do_ocr and self.ocr_reader:
                            plate_text = self.ocr_reader.read(plate_crop)

                        plates.append({
                            "vehicle_idx": v_idx,
                            "vehicle_label": vlabel,
                            "box": [gx1, gy1, gx2, gy2],
                            "conf": pconf,
                            "text": plate_text,
                            "crop": plate_crop
                        })

                        # Draw plate box (Vibrant Green)
                        cv2.rectangle(annotated, (gx1, gy1), (gx2, gy2), (0, 255, 64), 3)

                        # Render text badge
                        p_tag = f"[{plate_text}] {pconf:.0%}" if plate_text else f"Plate {pconf:.1%}"
                        (lw, lh), _ = cv2.getTextSize(p_tag, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
                        badge_y = max(0, gy1 - lh - 8)
                        cv2.rectangle(annotated, (gx1, badge_y), (gx1 + lw + 8, gy1), (0, 255, 64), -1)
                        cv2.putText(annotated, p_tag, (gx1 + 4, gy1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 2)
        # Fallback direct detection across full frame if vehicle crops yielded no plates
        if len(plates) == 0:
            p_res = self.plate_model.predict(
                frame,
                conf=0.06,
                imgsz=imgsz,
                device=self.device,
                verbose=False
            )[0]
            if p_res.boxes is not None and len(p_res.boxes) > 0:
                for pb in p_res.boxes:
                    gx1, gy1, gx2, gy2 = map(int, pb.xyxy[0])
                    pconf = float(pb.conf[0])
                    gx1, gy1 = max(0, gx1), max(0, gy1)
                    gx2, gy2 = min(orig_w, gx2), min(orig_h, gy2)
                    plate_crop = frame[gy1:gy2, gx1:gx2]

                    plate_text = ""
                    if do_ocr and self.ocr_reader:
                        plate_text = self.ocr_reader.read(plate_crop)

                    plates.append({
                        "vehicle_idx": None,
                        "vehicle_label": "unknown",
                        "box": [gx1, gy1, gx2, gy2],
                        "conf": pconf,
                        "text": plate_text,
                        "crop": plate_crop
                    })

                    cv2.rectangle(annotated, (gx1, gy1), (gx2, gy2), (0, 255, 64), 3)
                    p_tag = f"[{plate_text}] {pconf:.0%}" if plate_text else f"Plate {pconf:.1%}"
                    (lw, lh), _ = cv2.getTextSize(p_tag, cv2.FONT_HERSHEY_SIMPLEX, 0.65, 2)
                    badge_y = max(0, gy1 - lh - 8)
                    cv2.rectangle(annotated, (gx1, badge_y), (gx1 + lw + 8, gy1), (0, 255, 64), -1)
                    cv2.putText(annotated, p_tag, (gx1 + 4, gy1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 2)

        return {
            "vehicles": vehicles,
            "plates": plates,
            "annotated": annotated
        }

    def process_video(self, video_path, output_path=None, conf=0.06, do_ocr=True, show_fps=True):
        """
        Process a video file with the Two-Stage ANPR + TrOCR pipeline.
        Yields (frame_idx, annotated_frame, detections_dict) for each frame.
        """
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        writer = None
        if output_path is not None:
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            writer = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

        frame_idx = 0
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                t0 = cv2.getTickCount()
                res = self.detect(frame, p_conf=conf, do_ocr=do_ocr)
                dt = (cv2.getTickCount() - t0) / cv2.getTickFrequency()
                current_fps = 1.0 / dt if dt > 0 else 0

                annotated = res["annotated"]
                if show_fps:
                    cv2.putText(annotated, f"FPS: {current_fps:.1f}", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

                if writer is not None:
                    writer.write(annotated)

                yield frame_idx, annotated, res
                frame_idx += 1
        finally:
            cap.release()
            if writer is not None:
                writer.release()
