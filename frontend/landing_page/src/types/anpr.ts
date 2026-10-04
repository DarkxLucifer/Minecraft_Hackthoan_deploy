export interface VideoItem {
  filename: string;
  stem: string;
  size_mb: number;
  duration_seconds: number;
  formatted_duration: string;
  fps: number;
  width: number;
  height: number;
  has_anpr_annotated: boolean;
  plate_count: number;
}

export interface TimelineMarker {
  timestamp: number;
  percentage: number;
  frame: number;
  box: [number, number, number, number];
  formatted_time: string;
}

export interface Vehicle {
  plate: string;
  track_id: string;
  state: string;
  best_ocr_confidence: number;
  best_detector_confidence: number;
  first_seen: number;
  last_seen: number;
  formatted_first_seen: string;
  formatted_last_seen: string;
  total_occurrences: number;
  best_frame: number;
  best_box: [number, number, number, number];
  timeline_timestamps: number[];
  timeline_markers: TimelineMarker[];
  is_exact_match?: boolean;
  match_score?: number;
}

export interface SearchResult {
  query: string;
  cleaned_query: string;
  matched: boolean;
  total_matches: number;
  best_match: Vehicle | null;
  all_matches: Vehicle[];
  video_duration: number;
}

export interface VideoAnalysis {
  video_stem: string;
  duration: number;
  total_vehicles: number;
  vehicles: Vehicle[];
}

export interface CameraSighting {
  camera_id: string;
  camera_name: string;
  camera_zone: string;
  video_name: string;
  video_stem: string;
  plate: string;
  state: string;
  first_seen: number;
  last_seen: number;
  formatted_first_seen: string;
  formatted_last_seen: string;
  total_sightings: number;
  best_ocr_confidence: number;
  best_detector_confidence: number;
  best_frame: number;
  best_box: [number, number, number, number];
  timeline_markers: TimelineMarker[];
}

export interface MultiCameraSearchResult {
  query: string;
  cleaned_query: string;
  matched: boolean;
  cameras_detected_in: number;
  total_cameras_scanned: number;
  sightings: CameraSighting[];
}

export interface SurveillanceRecord {
  record_id: string;
  plate: string;
  raw_plate: string;  
  is_standard_format: boolean;
  validation_status: string;
  confidence_grade: string;
  state_code: string;
  rto_district: string;
  series: string;
  registration_number: string;
  state_name: string;
  explanation: string;
  camera_id: string;
  camera_name: string;
  camera_zone: string;
  video_name: string;
  video_stem: string;
  first_seen: number;
  last_seen: number;
  formatted_first_seen: string;
  formatted_last_seen: string;
  total_sightings: number;
  best_ocr_confidence: number;
  best_detector_confidence: number;
  best_frame: number;
  best_box: [number, number, number, number];
  timeline_markers: TimelineMarker[];
}

export interface DatabaseResponse {
  total_records: number;
  verified_standard_count: number;
  raw_noise_count: number;
  camera_options: { id: string; label: string }[];
  records: SurveillanceRecord[];
}

export interface GpuStatus {
  gpu_available: boolean;
  device_name: string;
  cuda_version?: string;
  vram_total_gb?: number;
  vram_allocated_gb?: number;
  tensor_cores_fp16?: boolean;
  status: string;
}

export interface GpuJobProgress {
  video_name?: string;
  status: 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ALREADY_PROCESSING' | 'STARTED';
  progress_percent: number;
  frame?: number;
  total_frames?: number;
  fps?: number;
  eta_seconds?: number;
  plates_spotted?: string[];
  message?: string;
  error?: string;
}


export interface DashboardStats {
  total_vehicles_tracked: number;
  verified_standard_plates: number;
  active_cameras: number;
  total_cameras: number;
  alerts_fired: number;
  critical_alerts: number;
  gpu?: GpuStatus;
}
