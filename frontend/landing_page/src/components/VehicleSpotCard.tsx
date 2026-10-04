"use client";

import React from 'react';
import { ShieldCheck, MapPin, Clock, Gauge, Hash, PlayCircle, Car } from 'lucide-react';
import type { Vehicle } from '../types/anpr';

interface VehicleSpotCardProps {
  vehicle: Vehicle | null;
  videoName: string;
  onSelectTimestamp: (timestamp: number) => void;
  currentTimestamp?: number;
}

import { BACKEND_URL } from "@/lib/config";

export const VehicleSpotCard: React.FC<VehicleSpotCardProps> = ({
  vehicle,
  videoName,
  onSelectTimestamp,
  currentTimestamp = 0,
}) => {
  if (!vehicle) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-black/10 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[380px] shadow-sm">
        <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-4 text-[#6F6F6F]">
          <Car className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-serif text-black mb-2">No Vehicle Spotted Yet</h3>
        <p className="text-sm text-[#6F6F6F] max-w-sm">
          Enter a license plate in the search bar above or choose one from the detected fleet list below to examine its timeline and video frames.
        </p>
      </div>
    );
  }

  const [x1, y1, x2, y2] = vehicle.best_box || [0, 0, 100, 100];
  const vstem = videoName.replace(/\.mp4$/i, "");
  const localStaticCrop = `/crops/${vstem}_frame${vehicle.best_frame}_${vehicle.plate}.jpg`;
  const remoteCropUrl = `${BACKEND_URL}/api/crop/${videoName}?frame=${vehicle.best_frame}&x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}&plate=${vehicle.plate}`;

  const [imgSrc, setImgSrc] = React.useState<string>(localStaticCrop);

  React.useEffect(() => {
    const s = videoName.replace(/\.mp4$/i, "");
    setImgSrc(`/crops/${s}_frame${vehicle.best_frame}_${vehicle.plate}.jpg`);
  }, [videoName, vehicle.best_frame, vehicle.plate]);

  return (
    <div className="bg-white/90 backdrop-blur-xl border border-black/10 rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/5 space-y-6">
      {/* Card Header & Plate Badge */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/5 pb-5">
        <div>
          <span className="text-[11px] font-semibold text-[#6F6F6F] uppercase tracking-wider block mb-1">
            Identified Registration
          </span>
          {/* Embossed Number Plate Badge */}
          <div className="inline-flex items-center border-2 border-black rounded-lg px-4 py-1.5 bg-gradient-to-b from-white to-gray-100 shadow-inner">
            <div className="flex flex-col items-center justify-center pr-2.5 mr-2.5 border-r border-black/30">
              <span className="text-[9px] font-bold tracking-tighter text-blue-900 leading-none">IND</span>
              <div className="w-2 h-2 rounded-full border border-blue-900 mt-0.5" />
            </div>
            <span className="text-2xl font-mono font-black tracking-widest text-black">
              {vehicle.plate}
            </span>
          </div>
        </div>

        {/* State Badge */}
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-semibold text-[#6F6F6F] uppercase tracking-wider block mb-1">
            Region / Jurisdiction
          </span>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 text-black text-xs font-medium">
            <MapPin className="w-3.5 h-3.5 text-black/70" />
            <span>{vehicle.state}</span>
          </div>
        </div>
      </div>

      {/* Vehicle Snapshot Crop Preview */}
      <div className="relative rounded-2xl overflow-hidden bg-black/90 border border-black/10 aspect-[16/9] flex items-center justify-center">
        <img
          src={imgSrc}
          alt={`Cropped vehicle frame for ${vehicle.plate}`}
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={() => {
            if (imgSrc !== remoteCropUrl) {
              setImgSrc(remoteCropUrl);
            }
          }}
        />
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-mono text-white flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Best Detection Frame #{vehicle.best_frame}</span>
        </div>
      </div>

      {/* Metric Breakdown Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl p-3.5 border border-black/5">
          <span className="text-[11px] text-[#6F6F6F] block flex items-center gap-1 mb-1">
            <Gauge className="w-3 h-3" />
            OCR Conf.
          </span>
          <span className="text-lg font-mono font-bold text-black">
            {Math.round(vehicle.best_ocr_confidence * 100)}%
          </span>
        </div>

        <div className="bg-surface rounded-2xl p-3.5 border border-black/5">
          <span className="text-[11px] text-[#6F6F6F] block flex items-center gap-1 mb-1">
            <ShieldCheck className="w-3 h-3" />
            YOLO Conf.
          </span>
          <span className="text-lg font-mono font-bold text-black">
            {Math.round(vehicle.best_detector_confidence * 100)}%
          </span>
        </div>

        <div className="bg-surface rounded-2xl p-3.5 border border-black/5">
          <span className="text-[11px] text-[#6F6F6F] block flex items-center gap-1 mb-1">
            <Hash className="w-3 h-3" />
            Sightings
          </span>
          <span className="text-lg font-mono font-bold text-black">
            {vehicle.total_occurrences}x
          </span>
        </div>

        <div className="bg-surface rounded-2xl p-3.5 border border-black/5">
          <span className="text-[11px] text-[#6F6F6F] block flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3" />
            First Seen
          </span>
          <span className="text-sm font-mono font-semibold text-black">
            {vehicle.formatted_first_seen}
          </span>
        </div>
      </div>

      {/* Timeline Occurrences Scrubber List */}
      <div className="space-y-2 pt-2 border-t border-black/5">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-black flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#6F6F6F]" />
            Timeline Sightings (Click to Seek)
          </span>
          <span className="text-[#6F6F6F] font-mono">
            {vehicle.timeline_markers.length} moments
          </span>
        </div>

        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
          {vehicle.timeline_markers.map((marker, i) => {
            const isCurrent = Math.abs(marker.timestamp - currentTimestamp) < 0.25;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectTimestamp(marker.timestamp)}
                className={`text-xs font-mono px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isCurrent
                    ? 'bg-black text-white border-black shadow-md scale-105'
                    : 'bg-surface hover:bg-black/5 text-[#000000] border-black/10'
                }`}
              >
                <PlayCircle className={`w-3 h-3 ${isCurrent ? 'text-emerald-400' : 'text-[#6F6F6F]'}`} />
                <span>{marker.formatted_time}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
