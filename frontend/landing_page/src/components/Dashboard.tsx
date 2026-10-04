"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Cctv,
  Search,
  Database,
  MapPin,
  Activity,
  Cpu,
  ShieldCheck,
  Layers,
  Car,
  Sparkles,
  Clock,
  ArrowUpRight,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Zap,
  Radio,
  Eye,
  Scan,
} from "lucide-react";

import { VideoTimelinePlayer } from "./VideoTimelinePlayer";
import { VehicleSpotCard } from "./VehicleSpotCard";
import { PlateSearchSection } from "./PlateSearchSection";
import { CameraInvestigationBlog } from "./CameraInvestigationBlog";
import { SurveillanceDatabasePage } from "./SurveillanceDatabasePage";
import { DetectedVehiclesGallery } from "./DetectedVehiclesGallery";
import { GpsTransitMapPage } from "./GpsTransitMapPage";
import LiveAnprTester from "./LiveAnprTester";
import type { VideoItem, Vehicle, SearchResult, VideoAnalysis, DashboardStats } from "../types/anpr";
import { BACKEND_URL } from "@/lib/config";

const GRID = 16;
const CORRIDORS = [
  { name: "NH-48 Sector", pct: 62, speed: 42 },
  { name: "Ring Road East", pct: 38, speed: 26 },
  { name: "MG Corridor", pct: 74, speed: 52 },
  { name: "IT Expressway", pct: 50, speed: 35 },
];

const HOTSPOTS: [number, number][] = [
  [4, 5],
  [10, 9],
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"stream" | "investigation" | "database" | "map" | "tester">(
    "stream"
  );

  // Video and ANPR State
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>("1.mp4");
  const [searchQuery, setSearchQuery] = useState<string>("KA05MR9633");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [matchedVehicle, setMatchedVehicle] = useState<Vehicle | null>(null);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [videoDuration, setVideoDuration] = useState<number>(10);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);

  // Telemetry & Hardware status
  const [stats, setStats] = useState<DashboardStats>({
    total_vehicles_tracked: 2847,
    verified_standard_plates: 1942,
    active_cameras: 5,
    total_cameras: 12,
    alerts_fired: 7,
    critical_alerts: 2,
    gpu: {
      gpu_available: true,
      device_name: "NVIDIA GeForce RTX 2050",
      cuda_version: "12.8",
      vram_total_gb: 4.0,
      vram_allocated_gb: 1.15,
      status: "OPERATIONAL",
    },
  });

  // Simulated heatmap grid
  const [intensities, setIntensities] = useState<number[]>(() =>
    Array.from({ length: GRID * GRID }, (_, i) => {
      const x = i % GRID;
      const y = Math.floor(i / GRID);
      let h = 0;
      for (const hs of HOTSPOTS) h += Math.max(0, 1 - Math.hypot(x - hs[0], y - hs[1]) / 7);
      return Math.min(1, h * 0.85);
    })
  );

  const fetchStats = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Backend offline fallback
    }
  };

  const fetchVideos = async () => {
    try {
      let deletedList: string[] = [];
      try {
        const stored = localStorage.getItem("visionx_deleted_videos");
        deletedList = stored ? JSON.parse(stored) : [];
      } catch {}

      const res = await fetch(`${BACKEND_URL}/api/videos`);
      if (res.ok) {
        const data = await res.json();
        if (data.videos && data.videos.length > 0) {
          const filtered = data.videos.filter((v: any) => !deletedList.includes(v.filename));
          setVideos(filtered);
          if (!selectedVideo || deletedList.includes(selectedVideo)) {
            if (filtered.length > 0) {
              setSelectedVideo(filtered[0].filename);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching videos:", err);
    }
  };

  const fetchAnalysis = async (vidName: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analysis/${vidName}`);
      if (res.ok) {
        const data: VideoAnalysis = await res.json();
        if (data && data.vehicles) {
          // Sort vehicles by appearance time so the first car entering the frame is targeted
          const sortedVehicles = [...data.vehicles].sort((a, b) => {
            const aFirst = a.first_seen ?? a.timeline_markers?.[0]?.timestamp ?? 0;
            const bFirst = b.first_seen ?? b.timeline_markers?.[0]?.timestamp ?? 0;
            return aFirst - bFirst;
          });
          setAllVehicles(sortedVehicles);
          setVideoDuration(data.duration || 10);

          if (sortedVehicles.length > 0) {
            const top = sortedVehicles[0];
            setSearchQuery(top.plate);
            setMatchedVehicle(top);
            const initTime = top.timeline_markers?.[0]?.timestamp ?? top.first_seen ?? 0;
            setSelectedTimestamp(initTime);
          } else {
            setMatchedVehicle(null);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching analysis:", err);
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchStats();
  }, []);

  useEffect(() => {
    if (selectedVideo) {
      fetchAnalysis(selectedVideo);
    }
  }, [selectedVideo]);

  // Handle Search for a plate in current video
  const handleSearch = async (queryOverride?: string) => {
    const q = queryOverride !== undefined ? queryOverride : searchQuery;
    if (!q.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_name: selectedVideo, query: q }),
      });
      const data: SearchResult = await res.json();
      setIsSearching(false);
      const match = data.best_match || (data.all_matches && data.all_matches[0]) || null;
      if (data.matched && match) {
        setMatchedVehicle(match);
        if (match.timeline_markers && match.timeline_markers.length > 0) {
          setSelectedTimestamp(match.timeline_markers[0].timestamp);
        }
      } else {
        setMatchedVehicle(null);
      }
    } catch {
      setIsSearching(false);
    }
  };

  const handleSelectSuggestedVehicle = (veh: Vehicle) => {
    setSearchQuery(veh.plate);
    setMatchedVehicle(veh);
    if (veh.timeline_markers?.length > 0) {
      setSelectedTimestamp(veh.timeline_markers[0].timestamp);
    }
    const el = document.getElementById("player-screen");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleJumpToCamera = (videoName: string, timestamp: number, plate: string) => {
    setSelectedVideo(videoName);
    setSearchQuery(plate);
    setSelectedTimestamp(timestamp);
    handleSearch(plate);
    setActiveTab("stream");
    setTimeout(() => {
      const el = document.getElementById("player-screen");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 200);
  };

  const suggestedPlates = allVehicles.slice(0, 6).map((v) => v.plate);

  return (
    <div className="w-full space-y-10" id="visionx-dashboard">
      {/* ─── Top Telemetry Stat Bar ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vehicles Tracked */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-black/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#6F6F6F] mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Vehicles Tracked</span>
            <Car className="w-4 h-4 text-black" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-black">
              {stats.total_vehicles_tracked.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              ▲ 14%
            </span>
          </div>
          <div className="text-[11px] text-[#6F6F6F] mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{stats.verified_standard_plates} Verified Indian Plates</span>
          </div>
        </div>

        {/* Active CCTV Nodes */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-black/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#6F6F6F] mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">CCTV Feeds</span>
            <Cctv className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-black">
              {videos.length || stats.active_cameras} / {stats.total_cameras}
            </span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Live Online
            </span>
          </div>
          <div className="text-[11px] text-[#6F6F6F] mt-2">
            <span>Synchronized across 5 Corridor Zones</span>
          </div>
        </div>

        {/* AI Engine Telemetry */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-black/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#6F6F6F] mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">AI Models Active</span>
            <Cpu className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold font-mono text-black">
              YOLO11s + TrOCR
            </span>
          </div>
          <div className="text-[11px] text-[#6F6F6F] mt-2 flex items-center justify-between">
            <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">
              best_yolo.pt
            </span>
            <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold">
              Vision Transformer
            </span>
          </div>
        </div>

        {/* Hardware & GPU Acceleration */}
        <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-black/10 p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#6F6F6F] mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Hardware Compute</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-black truncate">
              {stats.gpu?.device_name || "NVIDIA RTX 2050"}
            </span>
          </div>
          <div className="text-[11px] text-[#6F6F6F] mt-2 flex items-center justify-between">
            <span>CUDA {stats.gpu?.cuda_version || "12.8"} FP16</span>
            <span className="font-mono text-xs font-semibold text-black">
              {stats.gpu?.vram_allocated_gb ? `${stats.gpu.vram_allocated_gb} / ${stats.gpu.vram_total_gb} GB` : "4.0 GB VRAM"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Command Center Navigation Tabs ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("stream")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "stream"
                ? "bg-black text-white shadow-md"
                : "bg-white/80 hover:bg-white text-black border border-black/10"
            }`}
          >
            <Cctv className="w-3.5 h-3.5" />
            CCTV Timeline & Player
          </button>

          <button
            onClick={() => setActiveTab("investigation")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "investigation"
                ? "bg-black text-white shadow-md"
                : "bg-white/80 hover:bg-white text-black border border-black/10"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Multi-Camera Spatio-Temporal Log
          </button>

          <button
            onClick={() => setActiveTab("database")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "database"
                ? "bg-black text-white shadow-md"
                : "bg-white/80 hover:bg-white text-black border border-black/10"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Surveillance Database & Verification
          </button>

          <button
            onClick={() => setActiveTab("map")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "map"
                ? "bg-black text-white shadow-md"
                : "bg-white/80 hover:bg-white text-black border border-black/10"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Transit Corridor Map
          </button>

          <button
            onClick={() => setActiveTab("tester")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "tester"
                ? "bg-black text-white shadow-md"
                : "bg-white/80 hover:bg-white text-black border border-black/10"
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            Live ANPR & TrOCR Tester
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchVideos();
              fetchStats();
              if (selectedVideo) fetchAnalysis(selectedVideo);
            }}
            className="p-2 rounded-xl bg-white border border-black/10 text-[#6F6F6F] hover:text-black hover:bg-black/5 transition-all"
            title="Refresh Telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── TAB 1: CCTV Stream & Interactive Timeline Spotter ─── */}
      {activeTab === "stream" && (
        <div className="space-y-8 animate-fade-in">
          {/* Search & Video Bar */}
          <PlateSearchSection
            videos={videos}
            selectedVideo={selectedVideo}
            onSelectVideo={setSelectedVideo}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearch={handleSearch}
            isLoading={isSearching}
            suggestedPlates={suggestedPlates}
            onAnalysisRefreshed={() => {
              fetchAnalysis(selectedVideo);
              fetchVideos();
            }}
            onDeleteVideo={(deletedName) => {
              setVideos((prev) => prev.filter((v) => v.filename !== deletedName));
            }}
          />

          {/* Player & Dossier Grid */}
          <div id="player-screen" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7">
              <VideoTimelinePlayer
                videoName={selectedVideo}
                matchedVehicle={matchedVehicle}
                allVehicles={allVehicles}
                videoDuration={videoDuration}
                onSelectTimestamp={(t) => setSelectedTimestamp(t)}
                selectedTimestamp={selectedTimestamp}
              />
            </div>

            <div className="lg:col-span-5">
              <VehicleSpotCard
                vehicle={matchedVehicle}
                videoName={selectedVideo}
                onSelectTimestamp={(t) => setSelectedTimestamp(t)}
                currentTimestamp={selectedTimestamp || 0}
              />
            </div>
          </div>

          {/* Detected Vehicles Gallery for this camera */}
          <DetectedVehiclesGallery
            vehicles={allVehicles}
            videoName={selectedVideo}
            selectedPlate={matchedVehicle?.plate}
            onSelectVehicle={handleSelectSuggestedVehicle}
          />
        </div>
      )}

      {/* ─── TAB 2: Multi-Camera Cross-Spotting & Investigation Log ─── */}
      {activeTab === "investigation" && (
        <div className="animate-fade-in">
          <CameraInvestigationBlog
            onJumpToCamera={handleJumpToCamera}
            initialQuery={searchQuery}
          />
        </div>
      )}

      {/* ─── TAB 3: Structured Surveillance Database & Syntax Validation ─── */}
      {activeTab === "database" && (
        <div className="animate-fade-in">
          <SurveillanceDatabasePage onJumpToCamera={handleJumpToCamera} />
        </div>
      )}

      {/* ─── TAB 4: Live Image ANPR Upload & TrOCR Character Reader ─── */}
      {activeTab === "tester" && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-black/10 p-6 shadow-xs">
            <h3 className="text-xl font-serif text-black mb-1">
              Live Three-Stage ANPR & Vision Transformer OCR Testing Studio
            </h3>
            <p className="text-xs text-[#6F6F6F]">
              Directly upload any vehicle image or snapshot to test the fine-tuned <strong>best_yolo.pt</strong> plate
              detector and <strong>trocr_indian_plates</strong> reader running locally on your machine.
            </p>
          </div>
          <LiveAnprTester />
        </div>
      )}

      {/* ─── TAB 5: Transit Corridor Map ─── */}
      {activeTab === "map" && (
        <div className="animate-fade-in">
          <GpsTransitMapPage
            onBackToDashboard={() => setActiveTab("stream")}
            initialPlate={searchQuery || "KA05MR9633"}
          />
        </div>
      )}

      {/* ─── Bottom Density Heatmap & Corridor Speeds ─── */}
      <div className="pt-8 border-t border-black/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Heatmap */}
          <div className="lg:col-span-5 bg-white/90 backdrop-blur-md rounded-2xl border border-black/10 p-6">
            <span className="mono text-xs">Sector Density</span>
            <h4 className="text-lg font-serif text-black mt-1 mb-4">Vehicle density by grid cell</h4>
            <div className="hm-wrap">
              <span className="hm-compass hm-n">N</span>
              <span className="hm-compass hm-s">S</span>
              <span className="hm-compass hm-w">W</span>
              <span className="hm-compass hm-e">E</span>
              <div className="hm">
                {intensities.map((v, i) => {
                  const t = Math.min(1, v);
                  const color =
                    t < 0.5
                      ? blend("#EDE9DD", "#F2A93B", t / 0.5)
                      : blend("#F2A93B", "#E4572E", (t - 0.5) / 0.5);
                  return <div key={i} style={{ background: color }} />;
                })}
              </div>
            </div>
            <div className="scale mt-4">
              <span>Low</span>
              <i></i>
              <span>High Density</span>
            </div>
          </div>

          {/* Average Speeds by Corridor */}
          <div className="lg:col-span-7 bg-white/90 backdrop-blur-md rounded-2xl border border-black/10 p-6 flex flex-col justify-between">
            <div>
              <span className="mono text-xs">Corridor Speeds</span>
              <h4 className="text-lg font-serif text-black mt-1 mb-4">Traffic velocity across arterial routes</h4>
              <div className="space-y-4">
                {CORRIDORS.map((c) => (
                  <div key={c.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-black">{c.name}</span>
                      <span className="font-mono font-bold text-black">{c.speed} km/h</span>
                    </div>
                    <div className="relative w-full h-3 bg-black/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${c.pct}%` }}
                      />
                      <span
                        className="absolute top-0 bottom-0 w-0.5 bg-black/40"
                        style={{ left: "66%" }}
                        title="Target 50 km/h"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#6F6F6F] pt-4 mt-4 border-t border-black/5">
              <span>Standard Urban Target: 50 km/h</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Normal flow across sectors
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function blend(a: string, b: string, t: number) {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 255,
    ag = (ah >> 8) & 255,
    ab = ah & 255;
  const br = (bh >> 16) & 255,
    bg = (bh >> 8) & 255,
    bb = bh & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}