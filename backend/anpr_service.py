import csv
import math
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Any
import cv2

# Base project paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR
VIDEOS_DIR = BASE_DIR / "videos"
RUNS_DIR = BASE_DIR / "runs"
CROPS_CACHE_DIR = BASE_DIR / "cache" / "crops"
CROPS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

FALLBACK_PROJECT_DIR = Path(r"D:\project\aiml prime\project\traffic-light")
FALLBACK_RUNS_DIR = FALLBACK_PROJECT_DIR / "runs"
FALLBACK_CROPS_DIR = Path(r"D:\project\aiml prime\project\traffic-light\full stack\backend\cache\crops")

VIDEOS_DIRS = [VIDEOS_DIR, FALLBACK_PROJECT_DIR]
RUNS_DIRS = [RUNS_DIR, FALLBACK_RUNS_DIR]
CROPS_DIRS = [CROPS_CACHE_DIR, FALLBACK_CROPS_DIR]


INDIAN_STATE_CODES = {
    "AP": "Andhra Pradesh",
    "AR": "Arunachal Pradesh",
    "AS": "Assam",
    "BR": "Bihar",
    "CG": "Chhattisgarh",
    "CH": "Chandigarh",
    "DD": "Daman & Diu",
    "DL": "Delhi",
    "DN": "Dadra & Nagar Haveli",
    "GA": "Goa",
    "GJ": "Gujarat",
    "HP": "Himachal Pradesh",
    "HR": "Haryana",
    "JH": "Jharkhand",
    "JK": "Jammu & Kashmir",
    "KA": "Karnataka",
    "KL": "Kerala",
    "LA": "Ladakh",
    "LD": "Lakshadweep",
    "MH": "Maharashtra",
    "ML": "Meghalaya",
    "MN": "Manipur",
    "MP": "Madhya Pradesh",
    "MZ": "Mizoram",
    "NL": "Nagaland",
    "OD": "Odisha",
    "PB": "Punjab",
    "PY": "Puducherry",
    "RJ": "Rajasthan",
    "SK": "Sikkim",
    "TN": "Tamil Nadu",
    "TR": "Tripura",
    "TS": "Telangana",
    "UK": "Uttarakhand",
    "UP": "Uttar Pradesh",
    "WB": "West Bengal",
}

def clean_plate_text(text: str) -> str:
    if not text:
        return ""
    text = str(text).upper()
    for char in [" ", "-", "_", ".", ":", "/", "\\"]:
        text = text.replace(char, "")
    return re.sub(r"[^A-Z0-9]", "", text)

def get_state_from_plate(plate: str) -> str:
    cleaned = clean_plate_text(plate)
    if len(cleaned) >= 2 and cleaned[:2] in INDIAN_STATE_CODES:
        return INDIAN_STATE_CODES[cleaned[:2]]
    return "India"

COMMON_NON_PLATE_WORDS = {
    "IND", "INDIA", "HOME", "LOANS", "FOLLOW", "TERRANO", "NUMERIX", 
    "PUCOLLEGE", "COLLEGE", "MIRROR", "FOCUS", "SAIPOOJAADIAMONDS", 
    "GIRLSTARTSPANICING", "SGOINGREVERSE", "STOPPINGAFTERTHESTOPLINE", 
    "BOOKPALACE", "COMPACY", "POLOEERTHA", "SERVICE", "TOTURNRIGHT",
    "FACEPALM", "DIAMONDS", "PANICING", "AFTERTHE",
    "VAJR", "VAJRA", "VAUR", "VAURE", "EXPRESS", "EXPRE", "POLICE", "AMBULANCE", "FIRE",
    "ARMY", "NAVY", "FORCE"
}

CAMERA_META_MAP = {
    "1": {"id": "CAM-01", "location": "Main Junction - North Approach", "zone": "Zone A (Downtown)"},
    "2": {"id": "CAM-02", "location": "East Expressway - Toll Plaza", "zone": "Zone B (Expressway)"},
    "4": {"id": "CAM-04", "location": "South Boulevard - Ring Intersection", "zone": "Zone C (South Arterial)"},
    "crash": {"id": "CAM-CRASH", "location": "Outer Highway Incident Unit", "zone": "Zone D (Highway Patrol)"},
    "army": {"id": "CAM-ARMY", "location": "Tactical Sector - Convoy Perimeter", "zone": "Zone E (Defense Sector)"},
    "toll": {"id": "CAM-TOLL", "location": "Interstate Toll Plaza", "zone": "Zone E (Toll Access)"},
    "15698741_2160_3840_30fps": {"id": "CAM-07", "location": "Highway Perimeter Gantry (AJ13LVN)", "zone": "Zone Arterial Highway"}
}

# ── Fuzzy Plate Matching Helpers ──────────────────────────────────────────────
_GLYPH_MAP = {
    "I": "1", "L": "1", "O": "0", "Q": "0", "D": "0",
    "Z": "2", "S": "5", "B": "8", "G": "6", "U": "V"
}

def normalize_fuzzy_key(text: str) -> str:
    """Normalize OCR-confusable characters to canonical digit/letter."""
    t = clean_plate_text(text)
    return "".join(_GLYPH_MAP.get(c, c) for c in t)

def calculate_plate_similarity(p1: str, p2: str) -> float:
    """Levenshtein similarity [0.0-1.0] with optical-substitution discount."""
    s1 = clean_plate_text(p1)
    s2 = clean_plate_text(p2)
    if not s1 or not s2:
        return 0.0
    if s1 == s2:
        return 1.0
    k1, k2 = normalize_fuzzy_key(s1), normalize_fuzzy_key(s2)
    if k1 == k2:
        return 0.98
    if k1 in k2 or k2 in k1:
        return 0.94
    if s1 in s2 or s2 in s1:
        return 0.90
    m, n = len(s1), len(s2)
    dp = [[0.0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = float(i)
    for j in range(n + 1):
        dp[0][j] = float(j)
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            c1, c2 = s1[i - 1], s2[j - 1]
            if c1 == c2:
                cost = 0.0
            elif _GLYPH_MAP.get(c1, c1) == _GLYPH_MAP.get(c2, c2):
                cost = 0.2  # optical confusion
            else:
                cost = 1.0
            dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost)
    return max(0.0, 1.0 - dp[m][n] / max(m, n))

FUZZY_THRESHOLD = 0.70  # min similarity to consider a plate "nearby"

def get_camera_info(stem: str) -> Dict[str, str]:
    if stem in CAMERA_META_MAP:
        return CAMERA_META_MAP[stem]
    cam_id = f"CAM-{stem.zfill(2) if stem.isdigit() else stem.upper()}"
    return {
        "id": cam_id,
        "location": f"Feed {stem.title()} Surveillance",
        "zone": "Surveillance Perimeter"
    }

def validate_and_format_standard_plate(raw_text: str) -> Dict[str, Any]:
    """
    Validates AI OCR output against standard Indian/Global vehicle plate formats.
    Corrects common OCR character confusions based on expected syntax.
    
    Standard Indian Plate Format:
    [2 Letters: State Code] [1-2 Digits: RTO District] [1-3 Letters: Series] [4 Digits: Serial Number]
    Example: KA 05 MR 9633
    Indian Armed Forces Format:
    [↑ Broad Arrow / O / 0] [2 Digits: Year] [1 Letter: Class] [5-6 Digits: Serial] [1 Letter: Check]
    Example: ↑06P019516H
    """
    cleaned = clean_plate_text(raw_text)
    
    # 1. Immediate rejection of OCR hallucinated signs/banners
    for bad in COMMON_NON_PLATE_WORDS:
        if bad in cleaned:
            return {
                "is_standard_format": False,
                "status": "OCR_NOISE_REJECTED",
                "standardized_plate": cleaned,
                "confidence_grade": "REJECTED",
                "state_code": "",
                "rto_district": "",
                "series": "",
                "registration_number": "",
                "state_name": "Invalid Banner / Street Sign Noise",
                "explanation": f"Rejected text containing non-plate word '{bad}'"
            }
            
    if len(cleaned) < 4 or len(cleaned) > 13:
        return {
            "is_standard_format": False,
            "status": "INVALID_LENGTH",
            "standardized_plate": cleaned,
            "confidence_grade": "UNVERIFIED",
            "state_code": "",
            "rto_district": "",
            "series": "",
            "registration_number": "",
            "state_name": "Unverified Length",
            "explanation": f"Plate length ({len(cleaned)} chars) outside valid range [4-13]"
        }

    # Standard Regex Patterns:
    # 1: Full standard 10-char: KA 05 MR 9633 or KA 51 AF 5156
    re_std_1 = re.compile(r"^([A-Z]{2})([0-9]{2})([A-Z]{1,3})([0-9]{4})$")
    # 2: Single digit RTO: KA 5 MR 9633
    re_std_2 = re.compile(r"^([A-Z]{2})([0-9]{1})([A-Z]{1,3})([0-9]{4})$")
    # 3: Vintage without RTO: JK 5098 (State + 4-digit serial)
    re_std_3 = re.compile(r"^([A-Z]{2})([0-9]{4})$")
    # 3b: Two-wheeler / Vintage with 2-digit RTO: KA 05 9633
    re_std_3_dist = re.compile(r"^([A-Z]{2})([0-9]{2})([0-9]{4})$")
    # 4: Commercial / Series variant: DL 01 A 1234 or KA 05 M 9633 (Always 4 digits serial)
    re_std_4 = re.compile(r"^([A-Z]{2})([0-9]{1,2})([A-Z]{1,2})([0-9]{4})$")
    # 5: Bharat Series: 22 BH 1234 AA
    re_bh = re.compile(r"^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$")
    # 6: Indian Armed Forces / Defense Vehicle: ↑06P019516H or O6P019516H or 06D019507K
    re_mil = re.compile(r"^[O01]?([0-9]{2})([A-Z]{1})([0-9]{5,6})([A-Z]{1})$")

    # A. Check strict match against standard civilian formats
    for regex in [re_std_1, re_std_2]:
        m = regex.match(cleaned)
        if m and m.group(1) in INDIAN_STATE_CODES:
            st, rto, ser, num = m.groups()
            return {
                "is_standard_format": True,
                "status": "VERIFIED_STANDARD",
                "standardized_plate": cleaned,
                "confidence_grade": "HIGH",
                "state_code": st,
                "rto_district": rto,
                "series": ser,
                "registration_number": num,
                "state_name": INDIAN_STATE_CODES[st],
                "explanation": f"Verified Standard Indian Plate ({INDIAN_STATE_CODES[st]}, RTO {rto}, Series {ser}, No. {num})"
            }

    m_vintage = re_std_3.match(cleaned)
    if m_vintage and m_vintage.group(1) in INDIAN_STATE_CODES:
        st, num = m_vintage.groups()
        return {
            "is_standard_format": True,
            "status": "VERIFIED_STANDARD",
            "standardized_plate": cleaned,
            "confidence_grade": "HIGH",
            "state_code": st,
            "rto_district": "",
            "series": "",
            "registration_number": num,
            "state_name": INDIAN_STATE_CODES[st],
            "explanation": f"Verified Standard Vintage / Two-Wheeler Plate ({INDIAN_STATE_CODES[st]}, No. {num})"
        }

    m_vintage_dist = re_std_3_dist.match(cleaned)
    if m_vintage_dist and m_vintage_dist.group(1) in INDIAN_STATE_CODES:
        st, rto, num = m_vintage_dist.groups()
        return {
            "is_standard_format": True,
            "status": "VERIFIED_STANDARD",
            "standardized_plate": cleaned,
            "confidence_grade": "HIGH",
            "state_code": st,
            "rto_district": rto,
            "series": "",
            "registration_number": num,
            "state_name": INDIAN_STATE_CODES[st],
            "explanation": f"Verified Standard Two-Wheeler Plate ({INDIAN_STATE_CODES[st]}, RTO {rto}, No. {num})"
        }

    m_comm = re_std_4.match(cleaned)
    if m_comm and m_comm.group(1) in INDIAN_STATE_CODES:
        st, rto, ser, num = m_comm.groups()
        return {
            "is_standard_format": True,
            "status": "VERIFIED_STANDARD",
            "standardized_plate": cleaned,
            "confidence_grade": "HIGH",
            "state_code": st,
            "rto_district": rto,
            "series": ser,
            "registration_number": num,
            "state_name": INDIAN_STATE_CODES[st],
            "explanation": f"Verified Commercial / Series Plate ({INDIAN_STATE_CODES[st]}, RTO {rto}, Series {ser}, No. {num})"
        }

    m_bh = re_bh.match(cleaned)
    if m_bh:
        yr, bh, num, ser = m_bh.groups()
        return {
            "is_standard_format": True,
            "status": "VERIFIED_BHARAT_SERIES",
            "standardized_plate": cleaned,
            "confidence_grade": "HIGH",
            "state_code": "BH",
            "rto_district": yr,
            "series": ser,
            "registration_number": num,
            "state_name": "Bharat Series (All India)",
            "explanation": f"Verified Bharat Series Registration (Year 20{yr}, Series {ser}, No. {num})"
        }

    m_mil = re_mil.match(cleaned)
    if m_mil:
        yr, cls_letter, serial, chk = m_mil.groups()
        std = f"↑{yr}{cls_letter}{serial}{chk}"
        return {
            "is_standard_format": True,
            "status": "VERIFIED_DEFENSE_FORCES",
            "standardized_plate": std,
            "raw_plate": cleaned,
            "confidence_grade": "HIGH",
            "state_code": "DEF",
            "rto_district": yr,
            "series": cls_letter,
            "registration_number": serial,
            "state_name": "Indian Armed Forces (Ministry of Defence)",
            "explanation": f"Verified Armed Forces Vehicle Registration (Procurement 20{yr}, Class {cls_letter}, Serial {serial}-{chk})"
        }

    # B. Heuristic OCR Confusion Correction for Standard Plates
    corrected = cleaned
    if corrected.startswith("XA") or corrected.startswith("X0"):
        corrected = "KA" + corrected[2:]
    elif corrected.startswith("K4"):
        corrected = "KA" + corrected[2:]
    elif corrected.startswith("IO5") or corrected.startswith("1O5"):
        corrected = "KA05" + corrected[3:]

    # Attempt positional correction if length == 10 and starts with valid state
    if len(corrected) == 10 and corrected[:2] in INDIAN_STATE_CODES:
        st = corrected[:2]
        # Position 2,3: RTO Digits
        rto = corrected[2:4].replace("O", "0").replace("I", "1").replace("S", "5").replace("B", "8").replace("Z", "2")
        # Position 4,6: Series Letters
        ser = corrected[4:6].replace("0", "O").replace("1", "I").replace("4", "A").replace("5", "S")
        # Position 6,10: Serial Digits
        num = corrected[6:10].replace("O", "0").replace("I", "1").replace("S", "5").replace("B", "8").replace("Z", "2")
        
        reconstructed = f"{st}{rto}{ser}{num}"
        if re_std_1.match(reconstructed):
            return {
                "is_standard_format": True,
                "status": "RECONSTRUCTED_STANDARD",
                "standardized_plate": reconstructed,
                "raw_plate": cleaned,
                "confidence_grade": "MEDIUM_HIGH",
                "state_code": st,
                "rto_district": rto,
                "series": ser,
                "registration_number": num,
                "state_name": INDIAN_STATE_CODES[st],
                "explanation": f"Reconstructed from OCR misread '{cleaned}' -> '{reconstructed}'"
            }

    # C. Non-Standard / Incomplete Fragments (e.g. KA05KC, KA01A, KA03, HW9312)
    # Strictly marked as NON-STANDARD so they will never pollute the verified database
    return {
        "is_standard_format": False,
        "status": "INCOMPLETE_PLATE_FRAGMENT" if (len(cleaned) >= 4 and cleaned[:2] in INDIAN_STATE_CODES) else "NON_STANDARD_RAW",
        "standardized_plate": cleaned,
        "confidence_grade": "LOW",
        "state_code": cleaned[:2] if (len(cleaned) >= 2 and cleaned[:2] in INDIAN_STATE_CODES) else "",
        "rto_district": "",
        "series": "",
        "registration_number": "",
        "state_name": INDIAN_STATE_CODES.get(cleaned[:2], "Unverified Plate Format"),
        "explanation": "Does not conform to complete standard vehicle registration syntax (missing serial digits or invalid format)"
    }

class ANPRService:
    def __init__(self):
        self.videos_dirs = VIDEOS_DIRS
        self.runs_dirs = RUNS_DIRS

    def find_video_path(self, stem_or_filename: str) -> Optional[Path]:
        raw = Path(stem_or_filename).name
        stem = Path(raw).stem
        for vdir in self.videos_dirs:
            if not vdir.exists():
                continue
            for ext in [".mp4", ".avi", ".mov", ".mkv"]:
                p = vdir / f"{stem}{ext}"
                if p.exists():
                    return p
            p = vdir / raw
            if p.exists():
                return p
        return None

    def find_run_csv(self, stem: str) -> Optional[Path]:
        for rdir in self.runs_dirs:
            if not rdir.exists():
                continue
            for folder in ["video_anpr_gpu", "video_anpr_v1_1", "video_anpr"]:
                c = rdir / folder / f"{stem}_anpr.csv"
                if c.exists():
                    return c
        return None

    def get_available_videos(self) -> List[Dict[str, Any]]:
        """List all video files from local and project directories with metadata."""
        videos = []
        extensions = [".mp4", ".avi", ".mov", ".mkv"]
        seen_stems = set()

        for vdir in self.videos_dirs:
            if not vdir.exists():
                continue
            for file in sorted(vdir.iterdir()):
                if file.is_file() and file.suffix.lower() in extensions:
                    if "_anpr" in file.stem or file.stem.startswith("temp_"):
                        continue
                    if file.stem in seen_stems:
                        continue
                    seen_stems.add(file.stem)

                    video_info = self._get_video_metadata(file)
                    stem = file.stem
                    csv_path = self.find_run_csv(stem)
                    has_anpr_run = csv_path is not None

                    plate_count = self._get_plate_count(stem)

                    videos.append({
                        "filename": file.name,
                        "stem": stem,
                        "size_mb": round(file.stat().st_size / (1024 * 1024), 2),
                        "duration_seconds": video_info["duration"],
                        "formatted_duration": video_info["formatted_duration"],
                        "fps": video_info["fps"],
                        "width": video_info["width"],
                        "height": video_info["height"],
                        "has_anpr_annotated": has_anpr_run,
                        "plate_count": plate_count
                    })
        return videos

    def _get_video_metadata(self, video_path: Path) -> Dict[str, Any]:
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return {
                "duration": 0.0,
                "formatted_duration": "00:00",
                "fps": 30.0,
                "width": 1920,
                "height": 1080
            }

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration = round(frames / fps, 2) if frames > 0 and fps > 0 else 0.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        mins = int(duration // 60)
        secs = int(duration % 60)
        formatted_duration = f"{mins:02d}:{secs:02d}"

        return {
            "duration": duration,
            "formatted_duration": formatted_duration,
            "fps": round(fps, 2),
            "width": width,
            "height": height
        }

    def _get_plate_count(self, stem: str) -> int:
        summary = self.get_video_analysis(stem)
        return len(summary.get("vehicles", []))

    def get_video_analysis(self, video_name: str) -> Dict[str, Any]:
        """
        Parses the ANPR tracking CSVs for this video.
        """
        stem = Path(video_name).stem
        csv_path = self.find_run_csv(stem)

        video_path = self.find_video_path(stem)
        meta = self._get_video_metadata(video_path) if video_path and video_path.exists() else {"duration": 0.0}

        if not csv_path:
            return {
                "video_stem": stem,
                "total_vehicles": 0,
                "duration": meta["duration"],
                "vehicles": [],
                "all_occurrences": []
            }

        # 1. Parse all valid rows from CSV
        raw_rows = []
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    p = clean_plate_text(row.get("plate", ""))
                    if not p or len(p) < 3:
                        continue
                    raw_rows.append({
                        "frame": int(row.get("frame", 0)),
                        "timestamp": float(row.get("timestamp_seconds", 0.0)),
                        "track_id": str(row.get("track_id", "1")),
                        "plate": p,
                        "ocr_conf": float(row.get("ocr_confidence", 0.0)),
                        "det_conf": float(row.get("detector_confidence", 0.0)),
                        "x1": int(float(row.get("x1", 0))),
                        "y1": int(float(row.get("y1", 0))),
                        "x2": int(float(row.get("x2", 0))),
                        "y2": int(float(row.get("y2", 0))),
                    })
                except Exception:
                    continue

        if not raw_rows:
            return {
                "video_stem": stem,
                "total_vehicles": 0,
                "duration": meta["duration"],
                "vehicles": [],
                "all_occurrences": []
            }

        # 2. Group by track_id to resolve Temporal Plate Consensus:
        # Finds the plate from the CLEARLY VISIBLE moment (highest standard validity score & confidence)
        # and backpropagates it across all frames of that track (blurry start, apex, blurry departure)
        tracks_data: Dict[str, List[Dict[str, Any]]] = {}
        for r in raw_rows:
            t_id = r["track_id"]
            if t_id not in tracks_data:
                tracks_data[t_id] = []
            tracks_data[t_id].append(r)

        track_consensus: Dict[str, Dict[str, Any]] = {}
        for t_id, rows in tracks_data.items():
            best_score = -9999.0
            best_cand_plate = rows[0]["plate"]
            best_cand_conf = rows[0]["ocr_conf"]
            best_cand_std = best_cand_plate
            best_cand_is_std = False

            for r in rows:
                p = r["plate"]
                conf = r["ocr_conf"]
                val = validate_and_format_standard_plate(p)
                score = conf * 60.0
                std_p = val.get("standardized_plate", p)

                if val["is_standard_format"]:
                    score += 300.0  # Major bonus for verified standard plate
                elif val["status"] == "INCOMPLETE_PLATE_FRAGMENT":
                    score += 60.0 + len(p) * 2.0
                else:
                    score += 10.0 + len(p) * 1.0

                if score > best_score:
                    best_score = score
                    best_cand_plate = p
                    best_cand_conf = conf
                    best_cand_std = std_p
                    best_cand_is_std = val["is_standard_format"]

            track_consensus[t_id] = {
                "best_plate": best_cand_plate,
                "best_conf": best_cand_conf,
                "standardized_plate": best_cand_std,
                "is_standard": best_cand_is_std,
                "best_score": best_score
            }

        # 3. Propagate consensus plate across all occurrences
        occurrences = []
        vehicles_dict: Dict[str, Dict[str, Any]] = {}

        for r in raw_rows:
            t_id = r["track_id"]
            tc = track_consensus.get(t_id, {
                "standardized_plate": r["plate"],
                "best_conf": r["ocr_conf"],
                "is_standard": False
            })

            final_plate = tc["standardized_plate"]
            final_conf = max(r["ocr_conf"], tc["best_conf"])
            timestamp = r["timestamp"]
            frame = r["frame"]
            box = [r["x1"], r["y1"], r["x2"], r["y2"]]

            occ_item = {
                "frame": frame,
                "timestamp": round(timestamp, 3),
                "formatted_time": self._format_timestamp(timestamp),
                "track_id": t_id,
                "plate": final_plate,
                "ocr_confidence": round(final_conf, 3),
                "detector_confidence": round(r["det_conf"], 3),
                "box": box
            }
            occurrences.append(occ_item)

            # Build vehicle profiles grouped by the standardized plate
            # This merges fragmented tracks of the same vehicle into one profile
            key = final_plate
            if key not in vehicles_dict:
                vehicles_dict[key] = {
                    "plate": final_plate,
                    "track_id": t_id,
                    "state": get_state_from_plate(final_plate),
                    "best_ocr_confidence": round(final_conf, 3),
                    "best_detector_confidence": round(r["det_conf"], 3),
                    "first_seen": round(timestamp, 3),
                    "last_seen": round(timestamp, 3),
                    "formatted_first_seen": self._format_timestamp(timestamp),
                    "formatted_last_seen": self._format_timestamp(timestamp),
                    "total_occurrences": 1,
                    "best_frame": frame,
                    "best_box": box,
                    "timeline_timestamps": [round(timestamp, 3)],
                    "timeline_markers": [
                        {
                            "timestamp": round(timestamp, 3),
                            "percentage": round((timestamp / max(meta["duration"], 1.0)) * 100, 2),
                            "frame": frame,
                            "box": box,
                            "formatted_time": self._format_timestamp(timestamp)
                        }
                    ]
                }
            else:
                v = vehicles_dict[key]
                v["total_occurrences"] += 1
                v["first_seen"] = min(v["first_seen"], round(timestamp, 3))
                v["last_seen"] = max(v["last_seen"], round(timestamp, 3))
                v["formatted_first_seen"] = self._format_timestamp(v["first_seen"])
                v["formatted_last_seen"] = self._format_timestamp(v["last_seen"])
                v["timeline_timestamps"].append(round(timestamp, 3))
                v["timeline_markers"].append({
                    "timestamp": round(timestamp, 3),
                    "percentage": round((timestamp / max(meta["duration"], 1.0)) * 100, 2),
                    "frame": frame,
                    "box": box,
                    "formatted_time": self._format_timestamp(timestamp)
                })
                if r["ocr_conf"] > v["best_ocr_confidence"]:
                    v["best_ocr_confidence"] = round(r["ocr_conf"], 3)
                    v["best_detector_confidence"] = round(r["det_conf"], 3)
                    v["best_frame"] = frame
                    v["best_box"] = box

        # Sort timeline markers for each vehicle chronologically
        for v in vehicles_dict.values():
            v["timeline_markers"].sort(key=lambda m: m["timestamp"])
            v["timeline_timestamps"].sort()

        vehicle_list = list(vehicles_dict.values())
        vehicle_list.sort(key=lambda x: (x["total_occurrences"], x["best_ocr_confidence"]), reverse=True)

        return {
            "video_stem": stem,
            "duration": meta["duration"],
            "total_vehicles": len(vehicle_list),
            "vehicles": vehicle_list,
            "all_occurrences": occurrences
        }

    def search_plate(self, video_name: str, query: str) -> Dict[str, Any]:
        """
        Search for a license plate in the specified video.
        Supports exact match, substring, and fuzzy nearby-number prediction
        (e.g. AJI3LVN matches AJ13LVN via I↔1 optical substitution).
        """
        analysis = self.get_video_analysis(video_name)
        cleaned_query = clean_plate_text(query)

        if not cleaned_query:
            return {
                "query": query,
                "matched": False,
                "matches": [],
                "best_match": None,
                "video_duration": analysis.get("duration", 0.0)
            }

        matches = []
        for v in analysis.get("vehicles", []):
            plate = v["plate"]
            sim = calculate_plate_similarity(cleaned_query, plate)

            # Also check against nearby_predictions list
            for np_entry in v.get("nearby_predictions", []):
                np_plate = np_entry if isinstance(np_entry, str) else np_entry.get("plate", "")
                np_sim = calculate_plate_similarity(cleaned_query, np_plate)
                if np_sim > sim:
                    sim = np_sim

            if sim >= FUZZY_THRESHOLD or cleaned_query in plate or plate in cleaned_query:
                is_exact = (plate == cleaned_query)
                is_nearby = not is_exact and sim >= FUZZY_THRESHOLD
                matches.append({
                    **v,
                    "is_exact_match": is_exact,
                    "is_nearby_match": is_nearby,
                    "match_type": "EXACT_MATCH" if is_exact else "NEARBY_NUMBER_PREDICTION",
                    "similarity_score": round(sim, 3),
                    "match_score": 100 if is_exact else round(sim * 100),
                    "resolved_plate": plate,
                    "matched_against": cleaned_query,
                    "prediction_explanation": (
                        "Exact plate recognition" if is_exact
                        else f"Fuzzy nearby-number prediction (score={round(sim*100)}%, e.g. optical I↔1)"
                    )
                })

        matches.sort(key=lambda x: (x["is_exact_match"], x["similarity_score"], x["best_ocr_confidence"]), reverse=True)
        best_match = matches[0] if matches else None

        return {
            "query": query,
            "cleaned_query": cleaned_query,
            "matched": len(matches) > 0,
            "total_matches": len(matches),
            "best_match": best_match,
            "primary_match": best_match,
            "all_matches": matches,
            "matching_vehicles": matches,
            "video_duration": analysis.get("duration", 0.0)
        }

    def search_all_cameras(self, query: str) -> Dict[str, Any]:
        """
        Multi-Camera Cross-Spotting Investigation Log:
        Scans all available camera recordings (1.mp4, 2.mp4, 4.mp4, crash.mp4, army.mp4, etc.)
        and builds a chronological cross-camera appearance log for the specified plate.
        """
        cleaned_query = clean_plate_text(query)
        all_videos = self.get_available_videos()
        sightings = []

        if not cleaned_query:
            return {
                "query": query,
                "cleaned_query": "",
                "matched": False,
                "cameras_detected_in": 0,
                "total_cameras_scanned": len(all_videos),
                "sightings": []
            }

        for vid in all_videos:
            stem = vid["stem"]
            result = self.search_plate(vid["filename"], query)
            if result["matched"] and result["best_match"]:
                best = result["best_match"]
                cam_info = get_camera_info(stem)
                
                sightings.append({
                    "camera_id": cam_info["id"],
                    "camera_name": cam_info["location"],
                    "camera_zone": cam_info["zone"],
                    "video_name": vid["filename"],
                    "video_stem": stem,
                    "plate": best["plate"],
                    "state": best["state"],
                    "first_seen": best["first_seen"],
                    "last_seen": best["last_seen"],
                    "formatted_first_seen": best["formatted_first_seen"],
                    "formatted_last_seen": best["formatted_last_seen"],
                    "total_sightings": best["total_occurrences"],
                    "best_ocr_confidence": best["best_ocr_confidence"],
                    "best_detector_confidence": best["best_detector_confidence"],
                    "best_frame": best["best_frame"],
                    "best_box": best["best_box"],
                    "timeline_markers": best["timeline_markers"]
                })

        sightings.sort(key=lambda x: x["camera_id"])

        return {
            "query": query,
            "cleaned_query": cleaned_query,
            "matched": len(sightings) > 0,
            "cameras_detected_in": len(sightings),
            "total_cameras_scanned": len(all_videos),
            "sightings": sightings
        }

    def get_surveillance_database_records(
        self,
        valid_only: bool = True,
        camera_filter: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates database records of all vehicles captured across cameras.
        Applies standard plate format matching & OCR correction to filter/flag
        wrong AI OCR plate readings.
        """
        all_videos = self.get_available_videos()
        records = []
        clean_search = clean_plate_text(search) if search else ""
        camera_options = [{"id": "ALL", "label": "All Cameras & Feeds"}]
        seen_cams = set()

        for vid in all_videos:
            stem = vid["stem"]
            cam_info = get_camera_info(stem)

            if cam_info["id"] not in seen_cams:
                seen_cams.add(cam_info["id"])
                camera_options.append({
                    "id": cam_info["id"],
                    "label": f"{cam_info['id']} • {cam_info['location'].split(' - ')[0]}"
                })

            if camera_filter and camera_filter.upper() not in ["ALL", ""]:
                if camera_filter.upper() not in [cam_info["id"].upper(), stem.upper(), vid["filename"].upper()]:
                    continue

            analysis = self.get_video_analysis(vid["filename"])
            for veh in analysis.get("vehicles", []):
                raw_plate = veh["plate"]
                val_res = validate_and_format_standard_plate(raw_plate)
                
                # Check filter
                if valid_only and not val_res["is_standard_format"]:
                    continue

                std_plate = val_res.get("standardized_plate", raw_plate)
                
                if clean_search:
                    if clean_search not in clean_plate_text(std_plate) and clean_search not in clean_plate_text(raw_plate):
                        continue

                rec_id = f"REC-{cam_info['id']}-{stem}-{clean_plate_text(std_plate)}"
                records.append({
                    "record_id": rec_id,
                    "plate": std_plate,
                    "raw_plate": raw_plate,
                    "is_standard_format": val_res["is_standard_format"],
                    "validation_status": val_res["status"],
                    "confidence_grade": val_res.get("confidence_grade", "NORMAL"),
                    "state_code": val_res.get("state_code", ""),
                    "rto_district": val_res.get("rto_district", ""),
                    "series": val_res.get("series", ""),
                    "registration_number": val_res.get("registration_number", ""),
                    "state_name": val_res.get("state_name", veh["state"]),
                    "explanation": val_res.get("explanation", ""),
                    "camera_id": cam_info["id"],
                    "camera_name": cam_info["location"],
                    "camera_zone": cam_info["zone"],
                    "video_name": vid["filename"],
                    "video_stem": stem,
                    "first_seen": veh["first_seen"],
                    "last_seen": veh["last_seen"],
                    "formatted_first_seen": veh["formatted_first_seen"],
                    "formatted_last_seen": veh["formatted_last_seen"],
                    "total_sightings": veh["total_occurrences"],
                    "best_ocr_confidence": veh["best_ocr_confidence"],
                    "best_detector_confidence": veh["best_detector_confidence"],
                    "best_frame": veh["best_frame"],
                    "best_box": veh["best_box"],
                    "timeline_markers": veh["timeline_markers"]
                })

        records.sort(key=lambda x: (x["is_standard_format"], x["total_sightings"], x["best_ocr_confidence"]), reverse=True)
        verified_count = sum(1 for r in records if r["is_standard_format"])

        return {
            "total_records": len(records),
            "verified_standard_count": verified_count,
            "raw_noise_count": len(records) - verified_count,
            "camera_options": camera_options,
            "records": records
        }

    def extract_crop_thumbnail(self, video_name: str, frame_num: int, box: List[int], plate: str) -> Optional[Path]:
        """
        Extracts vehicle and plate crop using cv2 and caches to disk.
        """
        stem = Path(video_name).stem
        clean_p = clean_plate_text(plate) or "unknown"
        crop_filename = f"{stem}_frame{frame_num}_{clean_p}.jpg"

        # Check existing crop caches
        for cdir in CROPS_DIRS:
            cached_file = cdir / crop_filename
            if cached_file.exists():
                return cached_file

        video_path = self.find_video_path(stem)
        if not video_path or not video_path.exists():
            return None

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return None

        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        cap.release()

        if not ret or frame is None:
            return None

        h, w = frame.shape[:2]
        x1, y1, x2, y2 = box

        bw = max(1, x2 - x1)
        bh = max(1, y2 - y1)
        vx1 = max(0, x1 - int(bw * 1.5))
        vy1 = max(0, y1 - int(bh * 3.5))
        vx2 = min(w, x2 + int(bw * 1.5))
        vy2 = min(h, y2 + int(bh * 1.8))

        crop = frame[vy1:vy2, vx1:vx2]
        if crop.size == 0:
            crop = frame[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]

        if crop.size > 0:
            out_file = CROPS_CACHE_DIR / crop_filename
            cv2.imwrite(str(out_file), crop)
            return out_file

        return None

    def get_gpu_status(self) -> Dict[str, Any]:
        """Returns GPU hardware acceleration metrics and CUDA availability."""
        try:
            import torch
            if torch.cuda.is_available():
                dev_name = torch.cuda.get_device_name(0)
                total_mem = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)
                alloc_mem = round(torch.cuda.memory_allocated(0) / (1024**3), 2)
                return {
                    "gpu_available": True,
                    "device_name": dev_name,
                    "cuda_version": torch.version.cuda or "12.8",
                    "vram_total_gb": total_mem,
                    "vram_allocated_gb": alloc_mem,
                    "tensor_cores_fp16": True,
                    "status": "OPERATIONAL"
                }
        except Exception:
            pass

        return {
            "gpu_available": False,
            "device_name": "CPU Fallback",
            "error": "No CUDA device detected",
            "status": "CPU_MODE"
        }

    def _format_timestamp(self, seconds: float) -> str:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        millis = int((seconds - int(seconds)) * 1000)
        return f"{mins:02d}:{secs:02d}.{millis:03d}"

anpr_service = ANPRService()

