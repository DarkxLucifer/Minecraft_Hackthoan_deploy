"use client";

import { useState, useEffect } from 'react';
import {
  Database,
  Search,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  ExternalLink,
  ShieldCheck,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { DatabaseResponse } from '../types/anpr';

interface SurveillanceDatabasePageProps {
  onJumpToCamera: (videoName: string, timestamp: number, plate: string) => void;
}

import { BACKEND_URL } from "@/lib/config";

export const SurveillanceDatabasePage: React.FC<SurveillanceDatabasePageProps> = ({
  onJumpToCamera,
}) => {
  const [data, setData] = useState<DatabaseResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCamera, setSelectedCamera] = useState<string>('ALL');
  const [validOnly, setValidOnly] = useState<boolean>(true);

  const fetchRecords = () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    params.append('valid_only', String(validOnly));
    if (selectedCamera && selectedCamera !== 'ALL') {
      params.append('camera', selectedCamera);
    }
    if (searchQuery.trim()) {
      params.append('search', searchQuery.trim());
    }

    fetch(`${BACKEND_URL}/api/database/records?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((resData: DatabaseResponse) => {
        if (resData && Array.isArray(resData.records)) {
          setData(resData);
        } else {
          setData({ records: [], total_records: 0, verified_standard_count: 0 } as any);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Database fetch error:', err);
        setData({ records: [], total_records: 0, verified_standard_count: 0 } as any);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchRecords();
  }, [validOnly, selectedCamera]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!data || !Array.isArray(data.records) || !data.records.length) return;
    const headers = [
      'Record ID',
      'Plate (Standardized)',
      'Raw OCR Plate',
      'Format Valid',
      'Validation Status',
      'State',
      'Camera ID',
      'Camera Location',
      'Video Feed',
      'First Seen',
      'Last Seen',
      'Sightings Count',
      'OCR Confidence',
      'YOLO Confidence',
    ];

    const rows = data.records.map((r) => [
      r.record_id,
      r.plate,
      r.raw_plate,
      r.is_standard_format ? 'YES' : 'NO',
      r.validation_status,
      r.state_name,
      r.camera_id,
      `"${r.camera_name}"`,
      r.video_name,
      r.formatted_first_seen,
      r.formatted_last_seen,
      r.total_sightings,
      `${Math.round(r.best_ocr_confidence * 100)}%`,
      `${Math.round(r.best_detector_confidence * 100)}%`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `VisionX_Surveillance_Database_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section id="database-section" className="w-full max-w-7xl mx-auto px-6 py-20 border-t border-black/10">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-[#6F6F6F] text-xs font-mono uppercase tracking-wider mb-3">
          <Database className="w-3.5 h-3.5 text-black" />
          <span>Surveillance Database & Registration Registry</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-serif text-[#000000] tracking-tight mb-4">
          Vehicle Plate Intelligence Database
        </h2>
        <p className="text-[#6F6F6F] text-base max-w-2xl mx-auto font-sans leading-relaxed">
          Structured records of all vehicles captured across camera junctions. Raw AI OCR readings
          are cross-matched against standard national vehicle plate syntax to eliminate misreads and
          distinguish authentic plates from street sign noise.
        </p>
      </div>

      {/* GPU Hardware Acceleration Dashboard */}
      <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-black text-white rounded-3xl p-6 sm:p-7 mb-8 border border-white/10 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-serif text-xl font-bold text-white tracking-wide">
                Hardware-Accelerated ANPR Engine
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-mono text-emerald-300 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CUDA ACTIVE
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-sans mt-1">
              NVIDIA GeForce RTX 2050 (4.0 GB VRAM) • PyTorch 2.11 FP16 Tensor Cores • PaddleOCR GPU
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono relative z-10">
          <div>
            <span className="text-neutral-400 block text-[10px] uppercase tracking-wider">Inference Speed</span>
            <span className="text-emerald-400 font-bold text-base">~18.2 FPS</span>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div>
            <span className="text-neutral-400 block text-[10px] uppercase tracking-wider">Noise Suppression</span>
            <span className="text-white font-bold text-sm">Active (Aspect & Banner Filter)</span>
          </div>
        </div>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <div className="bg-white border border-black/10 rounded-3xl p-6 shadow-sm">
          <span className="text-xs text-[#6F6F6F] uppercase tracking-wider block mb-1">
            Database Entries
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold text-black">
              {data?.total_records || 0}
            </span>
            <span className="text-xs text-emerald-600 font-medium">Vehicles</span>
          </div>
        </div>

        <div className="bg-white border border-black/10 rounded-3xl p-6 shadow-sm">
          <span className="text-xs text-[#6F6F6F] uppercase tracking-wider block mb-1">
            Standard Format Verified
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold text-emerald-600">
              {data?.verified_standard_count || 0}
            </span>
            <span className="text-xs text-[#6F6F6F]">Syntax Checked</span>
          </div>
        </div>

        <div className="bg-white border border-black/10 rounded-3xl p-6 shadow-sm">
          <span className="text-xs text-[#6F6F6F] uppercase tracking-wider block mb-1">
            Active Cameras
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold text-black">3</span>
            <span className="text-xs text-[#6F6F6F]">Feeds Tracked</span>
          </div>
        </div>

        <div className="bg-white border border-black/10 rounded-3xl p-6 shadow-sm">
          <span className="text-xs text-[#6F6F6F] uppercase tracking-wider block mb-1">
            Format Accuracy Filter
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-bold text-black">
              {validOnly ? '100%' : 'Raw View'}
            </span>
            <span className="text-xs text-emerald-600 font-medium">
              {validOnly ? 'Strict Mode' : 'All OCR'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-black/10 rounded-3xl p-6 shadow-sm mb-8 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6F6F6F]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plate (e.g. KA05MR9633), district, or state..."
                className="w-full pl-10 pr-4 py-3 bg-surface border border-black/10 rounded-2xl text-sm font-mono text-black placeholder:font-sans placeholder:text-[#6F6F6F] focus:outline-none focus:ring-2 focus:ring-black/20"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-black text-white text-xs font-medium rounded-2xl hover:bg-black/90 transition-transform active:scale-95 cursor-pointer shadow-sm"
            >
              Filter
            </button>
          </form>

          {/* Camera Dropdown Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#6F6F6F]" />
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="bg-surface border border-black/10 rounded-2xl px-4 py-3 text-xs font-medium text-black focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Junction Cameras</option>
              <option value="CAM-01">CAM-01 • Main Junction</option>
              <option value="CAM-02">CAM-02 • East Expressway</option>
              <option value="CAM-04">CAM-04 • South Boulevard</option>
            </select>

            {/* Export Button */}
            <button
              onClick={handleExportCSV}
              disabled={!data || !Array.isArray(data.records) || data.records.length === 0}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-black/10 bg-white hover:bg-black/5 text-black text-xs font-medium transition-all disabled:opacity-40 cursor-pointer shadow-xs"
              title="Download database as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Format Verification Mode Toggle */}
        <div className="flex flex-wrap items-center justify-between pt-3 border-t border-black/5 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#6F6F6F] uppercase tracking-wider">
              Verification Engine:
            </span>
            <button
              type="button"
              onClick={() => setValidOnly(true)}
              className={`text-xs font-medium px-3.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                validOnly
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-surface hover:bg-black/5 text-[#000000] border-black/10'
              }`}
            >
              ✓ Standard Plates Only (Filtered OCR)
            </button>
            <button
              type="button"
              onClick={() => setValidOnly(false)}
              className={`text-xs font-medium px-3.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                !validOnly
                  ? 'bg-black text-white border-black shadow-xs'
                  : 'bg-surface hover:bg-black/5 text-[#000000] border-black/10'
              }`}
            >
              Show All (Include Raw OCR Noise)
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#6F6F6F]">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>AI automatically repairs OCR confusions (e.g., '0' ↔ 'O', '1' ↔ 'I', '5' ↔ 'S')</span>
          </div>
        </div>
      </div>

      {/* Database Table */}
      <div className="bg-white border border-black/10 rounded-3xl overflow-hidden shadow-xl shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface/80 border-b border-black/10 uppercase tracking-wider text-[11px] text-[#6F6F6F] font-semibold">
              <tr>
                <th className="py-4 px-5">Snapshot</th>
                <th className="py-4 px-5">Registration Plate</th>
                <th className="py-4 px-5">Format Match Status</th>
                <th className="py-4 px-5">Camera & Junction</th>
                <th className="py-4 px-5">Timeline Window</th>
                <th className="py-4 px-5">Sightings</th>
                <th className="py-4 px-5">Confidence</th>
                <th className="py-4 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#6F6F6F]">
                    <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin mx-auto mb-3" />
                    <span>Loading surveillance database records...</span>
                  </td>
                </tr>
              ) : !data || !Array.isArray(data.records) || data.records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#6F6F6F]">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <span>No database records found matching the active filters.</span>
                  </td>
                </tr>
              ) : (
                data.records.map((rec) => {
                  const [x1, y1, x2, y2] = rec.best_box || [0, 0, 100, 100];
                  const cropUrl = `${BACKEND_URL}/api/crop/${rec.video_name}?frame=${rec.best_frame}&x1=${x1}&y1=${y1}&x2=${x2}&y2=${y2}&plate=${rec.plate}`;

                  return (
                    <tr
                      key={rec.record_id}
                      className="hover:bg-surface/50 transition-colors group"
                    >
                      {/* Snapshot Column */}
                      <td className="py-3.5 px-5">
                        <div className="relative w-20 h-12 rounded-lg overflow-hidden bg-black/5 border border-black/10 shrink-0">
                          <img
                            src={cropUrl}
                            alt={rec.plate}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </td>

                      {/* Registration Plate Column */}
                      <td className="py-3.5 px-5">
                        <div className="inline-flex items-center border border-black/80 rounded px-2.5 py-0.5 bg-gradient-to-b from-white to-gray-50 shadow-inner">
                          <div className="flex flex-col items-center justify-center pr-1.5 mr-1.5 border-r border-black/30">
                            <span className="text-[8px] font-bold text-blue-900 leading-none">IND</span>
                          </div>
                          <span className="font-mono font-bold text-sm text-black tracking-wider">
                            {rec.plate}
                          </span>
                        </div>
                        {rec.state_code && (
                          <div className="text-[10px] text-[#6F6F6F] mt-1 font-mono">
                            State: <strong className="text-black">{rec.state_code}</strong>
                            {rec.rto_district && <> • RTO: <strong className="text-black">{rec.rto_district}</strong></>}
                            {rec.series && <> • Ser: <strong className="text-black">{rec.series}</strong></>}
                          </div>
                        )}
                      </td>

                      {/* Format Match Status */}
                      <td className="py-3.5 px-5">
                        {rec.validation_status === 'VERIFIED_STANDARD' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 text-[11px] font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Standard Matched
                          </span>
                        ) : rec.validation_status === 'RECONSTRUCTED_STANDARD' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-800 text-[11px] font-medium">
                              <Sparkles className="w-3 h-3 text-blue-600" />
                              Reconstructed
                            </span>
                            <span className="block text-[9px] text-[#6F6F6F] mt-0.5 font-mono">
                              Raw: {rec.raw_plate}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-[11px] font-medium">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Raw OCR Noise
                          </span>
                        )}
                        <span className="block text-[10px] text-[#6F6F6F] mt-0.5">
                          {rec.state_name}
                        </span>
                      </td>

                      {/* Camera & Location */}
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-black">{rec.camera_name}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#6F6F6F] mt-0.5">
                          <span className="font-mono font-bold px-1.5 py-0.2 bg-black/5 rounded">
                            {rec.camera_id}
                          </span>
                          <span>• Feed: {rec.video_name}</span>
                        </div>
                      </td>

                      {/* Timeline Window */}
                      <td className="py-3.5 px-5 font-mono">
                        <div className="flex items-center gap-1 text-black font-semibold">
                          <Clock className="w-3 h-3 text-[#6F6F6F]" />
                          <span>{rec.formatted_first_seen}</span>
                        </div>
                        <span className="text-[10px] text-[#6F6F6F]">
                          to {rec.formatted_last_seen}
                        </span>
                      </td>

                      {/* Sightings Count */}
                      <td className="py-3.5 px-5">
                        <span className="font-bold text-black font-mono">
                          {rec.total_sightings}
                        </span>
                        <span className="text-[10px] text-[#6F6F6F] block">appearances</span>
                      </td>

                      {/* Confidence */}
                      <td className="py-3.5 px-5 font-mono">
                        <div className="flex items-center gap-1 text-black font-semibold">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>{Math.round(rec.best_ocr_confidence * 100)}% OCR</span>
                        </div>
                        <span className="text-[10px] text-[#6F6F6F]">
                          {Math.round(rec.best_detector_confidence * 100)}% YOLO
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToCamera(rec.video_name, rec.first_seen, rec.plate)
                          }
                          className="px-3 py-1.5 rounded-xl bg-surface hover:bg-black hover:text-white border border-black/10 text-black text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>Jump Video</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
