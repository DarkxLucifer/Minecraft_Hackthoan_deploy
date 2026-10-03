"use client";

import React, { useState } from 'react';
import type { Vehicle } from '../types/anpr';
import { Search, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';

interface DetectedVehiclesGalleryProps {
  vehicles: Vehicle[];
  videoName: string;
  selectedPlate?: string;
  onSelectVehicle: (vehicle: Vehicle) => void;
}

import { BACKEND_URL } from "@/lib/config";

export const DetectedVehiclesGallery: React.FC<DetectedVehiclesGalleryProps> = ({
  vehicles,
  videoName,
  selectedPlate,
  onSelectVehicle,
}) => {
  const [filterQuery, setFilterQuery] = useState<string>('');

  const filteredVehicles = vehicles.filter((v) =>
    v.plate.toLowerCase().includes(filterQuery.toLowerCase()) ||
    v.state.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-3xl font-serif text-[#000000] tracking-tight">
            Detected Vehicle Catalog
          </h3>
          <p className="text-sm text-[#6F6F6F]">
            All {vehicles.length} distinct vehicles identified in <strong className="text-black">{videoName}</strong>
          </p>
        </div>

        {/* Quick Filter Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6F6F6F]" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter catalog..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-black/10 rounded-full text-xs text-black placeholder:text-[#6F6F6F] focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      {filteredVehicles.length === 0 ? (
        <div className="p-8 text-center bg-white/50 rounded-2xl border border-black/5 text-[#6F6F6F] text-sm">
          No vehicles match the filter "{filterQuery}".
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVehicles.map((veh) => {
            const isSelected = selectedPlate?.toUpperCase() === veh.plate;
            const [x1, y1, x2, y2] = veh.best_box || [0, 0, 100, 100];
            const cropUrl = `${BACKEND_URL}/api/crop/${videoName}?frame=${veh.best_frame}&x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}&plate=${veh.plate}`;

            return (
              <div
                key={veh.plate}
                onClick={() => onSelectVehicle(veh)}
                className={`group bg-white/80 hover:bg-white border rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between ${
                  isSelected
                    ? 'border-black ring-2 ring-black/10 shadow-md'
                    : 'border-black/10 hover:border-black/30'
                }`}
              >
                <div>
                  {/* Vehicle Thumbnail Preview */}
                  <div className="relative aspect-[16/9] bg-surface rounded-xl overflow-hidden mb-3 border border-black/5">
                    <img
                      src={cropUrl}
                      alt={veh.plate}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-white">
                      {veh.total_occurrences}x sightings
                    </div>
                  </div>

                  {/* Plate and State */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono font-bold text-base text-black tracking-wider">
                      {veh.plate}
                    </span>
                    <span className="text-[11px] font-medium text-[#6F6F6F] flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {veh.state}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-black/5 flex items-center justify-between text-xs text-[#6F6F6F]">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{Math.round(veh.best_ocr_confidence * 100)}% Conf.</span>
                  </div>

                  <span className="text-black font-medium group-hover:translate-x-1 transition-transform flex items-center gap-1 text-[11px]">
                    Spot Timeline <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
