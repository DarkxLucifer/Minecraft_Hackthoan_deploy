"use client";

import React, { useState, useEffect } from "react";
import { PlateSearchSection } from "@/components/PlateSearchSection";
import { VideoTimelinePlayer } from "@/components/VideoTimelinePlayer";
import { VehicleSpotCard } from "@/components/VehicleSpotCard";
import { CameraInvestigationBlog } from "@/components/CameraInvestigationBlog";
import { DetectedVehiclesGallery } from "@/components/DetectedVehiclesGallery";
import LiveAnprTester from "@/components/LiveAnprTester";
import type { VideoItem, Vehicle, SearchResult, VideoAnalysis } from "@/types/anpr";
import { BACKEND_URL } from "@/lib/config";

export const SearchStudioView: React.FC = () => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>("1.mp4");
  const [searchQuery, setSearchQuery] = useState<string>("KA05MR9633");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [matchedVehicle, setMatchedVehicle] = useState<Vehicle | null>(null);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [videoDuration, setVideoDuration] = useState<number>(10);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);

  const fetchVideos = () => {
    fetch(`${BACKEND_URL}/api/videos`)
      .then((res) => res.json())
      .then((data) => {
        if (data.videos && data.videos.length > 0) {
          setVideos(data.videos);
          if (!selectedVideo) {
            setSelectedVideo(data.videos[0].filename);
          }
        }
      })
      .catch((err) => console.error("Error fetching videos:", err));
  };

  const fetchAnalysis = (vidName: string) => {
    fetch(`${BACKEND_URL}/api/analysis/${vidName}`)
      .then((res) => res.json())
      .then((data: VideoAnalysis) => {
        if (data && data.vehicles) {
          setAllVehicles(data.vehicles);
          setVideoDuration(data.duration || 10);

          if (data.vehicles.length > 0) {
            const top = data.vehicles[0];
            setSearchQuery(top.plate);
            setMatchedVehicle(top);
            if (top.timeline_markers && top.timeline_markers.length > 0) {
              setSelectedTimestamp(top.timeline_markers[0].timestamp);
            }
          } else {
            setMatchedVehicle(null);
          }
        }
      })
      .catch((err) => console.error("Error fetching analysis:", err));
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    if (selectedVideo) {
      fetchAnalysis(selectedVideo);
    }
  }, [selectedVideo]);

  const handleSearch = (queryOverride?: string) => {
    const q = queryOverride !== undefined ? queryOverride : searchQuery;
    if (!q.trim()) return;

    setIsSearching(true);
    fetch(`${BACKEND_URL}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_name: selectedVideo, query: q }),
    })
      .then((res) => res.json())
      .then((data: SearchResult) => {
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
      })
      .catch((err) => {
        console.error("Search error:", err);
        setIsSearching(false);
      });
  };

  const handleSelectSuggestedVehicle = (veh: Vehicle) => {
    setSearchQuery(veh.plate);
    setMatchedVehicle(veh);
    if (veh.timeline_markers.length > 0) {
      setSelectedTimestamp(veh.timeline_markers[0].timestamp);
    }
    const el = document.getElementById("player-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleJumpToCameraFromBlog = (videoName: string, timestamp: number, plate: string) => {
    setSelectedVideo(videoName);
    setSearchQuery(plate);
    setSelectedTimestamp(timestamp);
    handleSearch(plate);
    const el = document.getElementById("player-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const suggestedPlates = allVehicles.slice(0, 6).map((v) => v.plate);

  return (
    <div className="w-full pb-20">
      {/* Studio Header referencing traffic-light */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-black/10 pb-5">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif text-black font-normal tracking-tight">
              Vehicle &amp; Timeline Spotter
            </h1>
            <p className="text-sm text-[#6F6F6F] mt-1 font-sans">
              Query vehicles across multi-camera streams with frame-exact timeline scrubbing and registration verification.
            </p>
          </div>
          <div className="text-xs font-mono text-[#6F6F6F] bg-white border border-black/10 px-3 py-1.5 rounded-full">
            Active Feeds: <span className="text-black font-semibold">{videos.length} Streams</span>
          </div>
        </div>
      </div>

      {/* Plate Search Bar & Video Switcher */}
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
      />

      {/* Video Player & Dossier Grid */}
      <div
        id="player-section"
        className="w-full max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16"
      >
        {/* CCTV Video Timeline Player */}
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

        {/* Spotted Vehicle Dossier Card */}
        <div className="lg:col-span-5">
          <VehicleSpotCard
            vehicle={matchedVehicle}
            videoName={selectedVideo}
            onSelectTimestamp={(t) => setSelectedTimestamp(t)}
            currentTimestamp={selectedTimestamp || 0}
          />
        </div>
      </div>

      {/* Multi-Camera Investigation Journal */}
      <div id="camera-journal">
        <CameraInvestigationBlog
          onJumpToCamera={handleJumpToCameraFromBlog}
          initialQuery={searchQuery}
        />
      </div>

      {/* Live ANPR & TrOCR Interactive Inference Section */}
      <section className="w-full max-w-6xl mx-auto px-6 py-16 border-t border-black/10">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-serif text-black tracking-tight">
            Live Character Recognition Studio
          </h2>
          <p className="text-sm text-[#6F6F6F] mt-1 max-w-2xl font-sans">
            Directly test arbitrary vehicle captures with the local Vision Transformer (TrOCR) and YOLO11s detector.
          </p>
        </div>
        <LiveAnprTester />
      </section>

      {/* Detected Vehicles Gallery */}
      <div id="catalog-section">
        <DetectedVehiclesGallery
          vehicles={allVehicles}
          videoName={selectedVideo}
          selectedPlate={matchedVehicle?.plate}
          onSelectVehicle={handleSelectSuggestedVehicle}
        />
      </div>
    </div>
  );
};

export default SearchStudioView;
