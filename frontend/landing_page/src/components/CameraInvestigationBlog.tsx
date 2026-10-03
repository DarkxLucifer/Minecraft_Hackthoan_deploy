"use client";

import React, { useState, useEffect } from 'react';
import {
  Cctv,
  Search,
  ShieldCheck,
  Clock,
  Car,
  ExternalLink,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { MultiCameraSearchResult } from '../types/anpr';

interface CameraInvestigationBlogProps {
  onJumpToCamera: (videoName: string, timestamp: number, plate: string) => void;
  initialQuery?: string;
}

import { BACKEND_URL } from "@/lib/config";

export const CameraInvestigationBlog: React.FC<CameraInvestigationBlogProps> = ({
  onJumpToCamera,
  initialQuery = 'KA05MR9633',
}) => {
  const [query, setQuery] = useState<string>(initialQuery);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<MultiCameraSearchResult | null>(null);

  const executeSearch = (targetPlate: string) => {
    if (!targetPlate.trim()) return;
    setIsLoading(true);

    fetch(`${BACKEND_URL}/api/multi-camera-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: targetPlate }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data: MultiCameraSearchResult) => {
        setIsLoading(false);
        if (data && typeof data.cameras_detected_in === 'number') {
          setSearchResult(data);
        }
      })
      .catch((err) => {
        console.error('Multi-camera search error:', err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    executeSearch(initialQuery);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleQuickChip = (plate: string) => {
    setQuery(plate);
    executeSearch(plate);
  };

  const popularPlates = ['KA05MR9633', 'KA05LA7078', 'KA05NC5241', 'JK5098'];

  return (
    <section id="camera-journal" className="w-full max-w-6xl mx-auto px-6 py-20 border-t border-black/10">
      {/* Blog & Surveillance Log Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[#6F6F6F] text-xs font-mono uppercase tracking-wider mb-3">
          <BookOpen className="w-3.5 h-3.5 text-black" />
          <span>Surveillance Journal & Cross-Camera Intelligence</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-serif text-[#000000] tracking-tight mb-4">
          Multi-Camera Investigation Log
        </h2>
        <p className="text-[#6F6F6F] text-base max-w-2xl mx-auto font-sans leading-relaxed">
          Enter any vehicle license plate to query the multi-camera network. Locate which
          surveillance cameras recorded the vehicle, view photographic captures at each junction,
          and track its path across the city grid.
        </p>
      </div>

      {/* Plate Search Input in Journal Style */}
      <div className="max-w-2xl mx-auto mb-14">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#6F6F6F]">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter registration plate (e.g. KA05MR9633)..."
              className="w-full bg-white border border-black/15 rounded-2xl pl-11 pr-4 py-4 text-base font-mono uppercase tracking-wider text-black placeholder:normal-case placeholder:font-sans placeholder:tracking-normal placeholder:text-[#6F6F6F]/60 focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black transition-all shadow-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-2xl px-8 py-4 bg-black text-white font-medium text-sm transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 cursor-pointer shadow-md"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Locate Cameras</span>
              </>
            )}
          </button>
        </form>

        {/* Suggested Plates */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
          <span className="text-[#6F6F6F] font-medium">Quick Query:</span>
          {popularPlates.map((plate) => (
            <button
              key={plate}
              type="button"
              onClick={() => handleQuickChip(plate)}
              className={`font-mono px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                query.toUpperCase() === plate
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-white hover:bg-black/5 text-[#000000] border-black/10'
              }`}
            >
              {plate}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      {searchResult && (
        <div className="space-y-12">
          {/* Summary Banner */}
          <div className="bg-white/90 backdrop-blur-xl border border-black/10 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center shrink-0 shadow-md">
                <Cctv className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#6F6F6F]">
                    Target Vehicle
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 text-[11px] font-medium">
                    {searchResult.matched ? 'Active Sightings' : 'No Sightings'}
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-mono font-black text-black tracking-wider">
                  {searchResult.cleaned_query || query.toUpperCase()}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 border-t md:border-t-0 md:border-l border-black/10 pt-4 md:pt-0 md:pl-8 text-xs text-[#6F6F6F]">
              <div>
                <span className="block text-[#6F6F6F] uppercase text-[10px] tracking-wider mb-0.5">
                  Cameras Detected In
                </span>
                <span className="text-xl font-serif font-bold text-black">
                  {searchResult.cameras_detected_in} of {searchResult.total_cameras_scanned} Cameras
                </span>
              </div>
              <div>
                <span className="block text-[#6F6F6F] uppercase text-[10px] tracking-wider mb-0.5">
                  Network Coverage
                </span>
                <span className="text-xl font-serif font-bold text-black">
                  {Math.round(
                    (searchResult.cameras_detected_in /
                      Math.max(searchResult.total_cameras_scanned, 1)) *
                      100
                  )}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* If No Sightings */}
          {!searchResult.matched && (
            <div className="bg-surface border border-black/10 rounded-3xl p-12 text-center text-[#6F6F6F]">
              <Car className="w-10 h-10 mx-auto mb-3 text-[#6F6F6F]/50" />
              <h4 className="text-lg font-serif text-black mb-1">
                No Camera Sightings for "{query.toUpperCase()}"
              </h4>
              <p className="text-sm max-w-md mx-auto">
                The license plate was not identified in any of the current camera recordings. Try
                searching for another plate such as <strong className="text-black">KA05MR9633</strong> or{' '}
                <strong className="text-black">KA05LA7078</strong>.
              </p>
            </div>
          )}

          {/* Chronological Camera Sightings Grid */}
          {searchResult.matched && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-2xl font-serif text-black tracking-tight">
                  Camera Capture Sequence
                </h4>
                <span className="text-xs text-[#6F6F6F]">
                  Arranged in chronological detection order
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {searchResult.sightings.map((sighting) => {
                  const [x1, y1, x2, y2] = sighting.best_box || [0, 0, 100, 100];
                  const cropUrl = `${BACKEND_URL}/api/crop/${sighting.video_name}?frame=${sighting.best_frame}&x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}&plate=${sighting.plate}`;

                  return (
                    <div
                      key={sighting.camera_id}
                      className="bg-white border border-black/10 rounded-3xl p-6 shadow-md hover:shadow-xl transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Camera Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-black text-white">
                                {sighting.camera_id}
                              </span>
                              <span className="text-xs text-[#6F6F6F] font-medium">
                                {sighting.camera_zone}
                              </span>
                            </div>
                            <h5 className="font-serif text-lg font-medium text-black">
                              {sighting.camera_name}
                            </h5>
                          </div>

                          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-surface border border-black/5 text-[#6F6F6F]">
                            Feed: {sighting.video_name}
                          </span>
                        </div>

                        {/* Snapshot from this Camera */}
                        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-black/5 border border-black/10 mb-4">
                          <img
                            src={cropUrl}
                            alt={`${sighting.plate} on ${sighting.camera_id}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono text-white flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            <span>First: {sighting.formatted_first_seen}</span>
                          </div>
                          <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono text-white">
                            {sighting.total_sightings} frame detections
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
                          <div className="p-2.5 rounded-xl bg-surface border border-black/5">
                            <span className="text-[#6F6F6F] block text-[10px] uppercase">
                              Confidence
                            </span>
                            <span className="font-mono font-bold text-black flex items-center gap-1 mt-0.5">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              {Math.round(sighting.best_ocr_confidence * 100)}% Match
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-surface border border-black/5">
                            <span className="text-[#6F6F6F] block text-[10px] uppercase">
                              Last Seen
                            </span>
                            <span className="font-mono font-bold text-black mt-0.5 block">
                              {sighting.formatted_last_seen}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button to seek directly in main player */}
                      <button
                        type="button"
                        onClick={() =>
                          onJumpToCamera(
                            sighting.video_name,
                            sighting.first_seen,
                            sighting.plate
                          )
                        }
                        className="w-full py-3 px-4 rounded-xl bg-black hover:bg-black/90 text-white text-xs font-medium transition-transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <span>Open & Play in {sighting.camera_id}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Editorial Surveillance Log Narrative */}
              <div className="bg-gradient-to-r from-white via-surface to-white border border-black/10 rounded-3xl p-6 sm:p-8 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-semibold text-black uppercase tracking-wider mb-2">
                  <BookOpen className="w-4 h-4 text-black" />
                  <span>Surveillance Incident Narrative</span>
                </div>
                <p className="text-sm text-[#6F6F6F] leading-relaxed font-sans">
                  Vehicle <strong className="text-black font-mono">{searchResult.cleaned_query}</strong> was
                  detected across{' '}
                  <strong className="text-black">{searchResult.cameras_detected_in} distinct surveillance cameras</strong>.
                  Initial recognition occurred at{' '}
                  <strong className="text-black">{searchResult.sightings[0]?.camera_name} ({searchResult.sightings[0]?.camera_id})</strong> at{' '}
                  <span className="font-mono text-black font-semibold">
                    {searchResult.sightings[0]?.formatted_first_seen}
                  </span>
                  {searchResult.sightings.length > 1 && (
                    <>
                      , followed by subsequent transit tracking at{' '}
                      <strong className="text-black">{searchResult.sightings[1]?.camera_name} ({searchResult.sightings[1]?.camera_id})</strong> at{' '}
                      <span className="font-mono text-black font-semibold">
                        {searchResult.sightings[1]?.formatted_first_seen}
                      </span>
                    </>
                  )}
                  . Both cameras confirmed state jurisdiction registered in{' '}
                  <strong className="text-black">{searchResult.sightings[0]?.state}</strong> with high detector confidence.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
