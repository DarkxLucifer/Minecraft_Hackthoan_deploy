"use client";

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Maximize2, Globe, Key, CheckCircle2, ShieldCheck, ExternalLink } from 'lucide-react';
import type { CameraNode, TransitTrajectory, DistrictInfo } from './GpsTransitMapPage';
import { BACKEND_URL } from '@/lib/config';
import realRoadRoutesData from '@/lib/data/real_road_routes.json';

interface RealLeafletDistrictMapProps {
  currentTrajectory: TransitTrajectory;
  districts: DistrictInfo[];
  cameras: CameraNode[];
  activeDistrictId: string;
  onSelectDistrict: (districtId: string) => void;
}

// Read CARTO API key from Next.js public environment
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY || '';
const CARTO_KEY_PARAM = CARTO_API_KEY.trim() ? `?api_key=${CARTO_API_KEY.trim()}` : '';

// CARTO Basemap Engine configurations
export const TILE_LAYERS = {
  satellite: {
    name: 'Satellite Aerial Recon (Hybrid)',
    label: 'Satellite',
    tag: 'Air Recon',
    engine: 'High-Res Satellite Mesh',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Hybrid Satellite & Transit',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
  },
  voyager: {
    name: 'CARTO Voyager',
    label: 'Voyager',
    tag: 'Editorial',
    engine: 'CARTO Basemap',
    url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${CARTO_KEY_PARAM}`,
    attribution: '&copy; <a href="https://carto.com/" target="_blank" rel="noopener">CARTO</a> &copy; <a href="https://openstreetmap.org" target="_blank" rel="noopener">OSM</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  positron: {
    name: 'CARTO Positron',
    label: 'Positron',
    tag: 'Minimal Light',
    engine: 'CARTO Basemap',
    url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${CARTO_KEY_PARAM}`,
    attribution: '&copy; <a href="https://carto.com/" target="_blank" rel="noopener">CARTO</a> &copy; <a href="https://openstreetmap.org" target="_blank" rel="noopener">OSM</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  dark: {
    name: 'CARTO Dark Matter',
    label: 'Dark Matter',
    tag: 'Night Recon',
    engine: 'CARTO Basemap',
    url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${CARTO_KEY_PARAM}`,
    attribution: '&copy; <a href="https://carto.com/" target="_blank" rel="noopener">CARTO</a> &copy; <a href="https://openstreetmap.org" target="_blank" rel="noopener">OSM</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },
};

// Real District Boundary Coordinates (Lat/Lng Polygons)
export const DISTRICT_GEO_POLYGONS: Record<string, [number, number][]> = {
  'bengaluru-urban': [
    [12.82, 77.46],
    [12.78, 77.68],
    [12.84, 77.78],
    [13.02, 77.76],
    [13.14, 77.64],
    [13.12, 77.48],
    [12.96, 77.44],
    [12.82, 77.46],
  ],
  ramanagara: [
    [12.58, 77.16],
    [12.78, 77.18],
    [12.82, 77.46],
    [12.65, 77.50],
    [12.48, 77.28],
    [12.58, 77.16],
  ],
  mandya: [
    [12.38, 76.72],
    [12.56, 76.62],
    [12.72, 76.88],
    [12.58, 77.16],
    [12.34, 77.02],
    [12.38, 76.72],
  ],
  mysuru: [
    [12.12, 76.42],
    [12.36, 76.40],
    [12.42, 76.72],
    [12.24, 76.86],
    [12.02, 76.68],
    [12.12, 76.42],
  ],
  tumakuru: [
    [13.10, 76.92],
    [13.44, 76.82],
    [13.56, 77.24],
    [13.18, 77.34],
    [13.10, 76.92],
  ],
  kolar: [
    [12.92, 77.82],
    [13.24, 77.88],
    [13.30, 78.32],
    [12.96, 78.28],
    [12.92, 77.82],
  ],
  'dakshina-kannada': [
    [12.68, 74.78],
    [13.04, 74.82],
    [13.10, 75.32],
    [12.64, 75.42],
    [12.68, 74.78],
  ],
};

// Real Expressways Alignment (High-Density Real Road Geometry from OSRM Network)
export const NH275_EXPRESSWAY_WAYPOINTS: [number, number][] =
  ((realRoadRoutesData as any)?.NH275_EXPRESSWAY as [number, number][]) || [
    [12.9081, 77.4875],
    [12.854, 77.432],
    [12.7985, 77.3824],
    [12.7214, 77.281],
    [12.6512, 77.195],
    [12.584, 77.0512],
    [12.5244, 76.8969],
    [12.445, 76.782],
    [12.4215, 76.698],
    [12.3375, 76.6578],
  ];

export const NH44_ELEVATED_WAYPOINTS: [number, number][] =
  ((realRoadRoutesData as any)?.NH44_ELEVATED as [number, number][]) || [
    [12.9172, 77.6228],
    [12.895, 77.635],
    [12.871, 77.648],
    [12.8452, 77.6602],
  ];

export const NICE_ROAD_WAYPOINTS: [number, number][] =
  ((realRoadRoutesData as any)?.NICE_ROAD as [number, number][]) || [
    [12.8452, 77.6602],
    [12.855, 77.56],
    [12.9081, 77.4875],
  ];

export const RealLeafletDistrictMap: React.FC<RealLeafletDistrictMapProps> = ({
  currentTrajectory,
  districts,
  cameras,
  activeDistrictId,
  onSelectDistrict,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const vectorLayersGroupRef = useRef<L.LayerGroup | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const initialBasemap = (process.env.NEXT_PUBLIC_CARTO_BASEMAP as keyof typeof TILE_LAYERS) || 'satellite';
  const [activeTileStyle, setActiveTileStyle] = useState<keyof typeof TILE_LAYERS>(
    initialBasemap in TILE_LAYERS ? initialBasemap : 'satellite'
  );
  const [showDistricts, setShowDistricts] = useState<boolean>(true);
  const [showCameras, setShowCameras] = useState<boolean>(true);
  const [showHighways, setShowHighways] = useState<boolean>(true);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [activeRouteInfo, setActiveRouteInfo] = useState<{
    distanceKm: number;
    durationMin: number;
    pointCount: number;
    routeName: string;
  } | null>(null);

  // Invalidate map size to prevent gray tiles and ensure proper viewport rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);
    const timer2 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 500);

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const container = mapContainerRef.current;

      // Center on Bengaluru - Mysuru Expressway Corridor
      const map = L.map(container, {
        center: [12.72, 77.15],
        zoom: 10,
        zoomControl: false,
        attributionControl: false,
        trackResize: true,
      });

      // Add zoom control at top right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Add base tile layer
      const config = TILE_LAYERS[activeTileStyle];
      const tileLayer = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: config.maxZoom,
        subdomains: config.subdomains,
        keepBuffer: 6,
        updateWhenIdle: false,
        updateWhenZooming: false,
      }).addTo(map);
      tileLayer.bringToBack();
      tileLayerRef.current = tileLayer;

      // Create Layer Groups
      const vectorGroup = L.layerGroup().addTo(map);
      vectorLayersGroupRef.current = vectorGroup;

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;

      // Mousemove coordinates listener
      map.on('mousemove', (e) => {
        setCursorCoords({
          lat: parseFloat(e.latlng.lat.toFixed(4)),
          lng: parseFloat(e.latlng.lng.toFixed(4)),
        });
      });

      mapInstanceRef.current = map;

      // Multi-tick invalidate size so the full tile grid renders immediately across the whole container
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
      setTimeout(() => map.invalidateSize(), 80);
      setTimeout(() => map.invalidateSize(), 300);
      setTimeout(() => map.invalidateSize(), 800);
      setTimeout(() => map.invalidateSize(), 1500);

      // ResizeObserver to automatically adapt whenever container size changes
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          map.invalidateSize();
        });
        ro.observe(container);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when active style changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const config = TILE_LAYERS[activeTileStyle];

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const newLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      subdomains: config.subdomains,
      keepBuffer: 6,
      updateWhenIdle: false,
      updateWhenZooming: false,
    }).addTo(map);
    newLayer.bringToBack();
    map.invalidateSize();

    tileLayerRef.current = newLayer;
  }, [activeTileStyle]);

  // Render Districts, Highways, Trajectory, and Camera Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !vectorLayersGroupRef.current || !markersGroupRef.current) return;

    const map = mapInstanceRef.current;
    const vectorGroup = vectorLayersGroupRef.current;
    const markersGroup = markersGroupRef.current;

    vectorGroup.clearLayers();
    markersGroup.clearLayers();

    // 1. RENDER DISTRICT JURISDICTION POLYGONS
    if (showDistricts) {
      districts.forEach((dist) => {
        const polyCoords = DISTRICT_GEO_POLYGONS[dist.id];
        if (!polyCoords) return;

        const isOrigin = currentTrajectory.firstSeen.districtName
          .toLowerCase()
          .includes(dist.name.toLowerCase().split(' ')[0]);
        const isDest = currentTrajectory.reappearedAt?.districtName
          .toLowerCase()
          .includes(dist.name.toLowerCase().split(' ')[0]);
        const isSelected = activeDistrictId === dist.id;

        let strokeColor = dist.color || '#94A3B8';
        let fillColor = dist.color || '#94A3B8';
        let fillOpacity = 0.08;
        let weight = 1.5;

        if (isOrigin) {
          strokeColor = '#2563EB';
          fillColor = '#3B82F6';
          fillOpacity = 0.22;
          weight = 3;
        } else if (isDest) {
          strokeColor = '#10B981';
          fillColor = '#10B981';
          fillOpacity = 0.22;
          weight = 3;
        } else if (isSelected) {
          strokeColor = '#000000';
          fillOpacity = 0.16;
          weight = 2.5;
        }

        const polygon = L.polygon(polyCoords, {
          color: strokeColor,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          weight: weight,
          dashArray: isOrigin || isDest ? undefined : '4, 4',
        });

        // Interactive tooltip
        polygon.bindTooltip(
          `<div style="font-family: Inter, sans-serif; padding: 4px 6px;">
            <div style="font-weight: 700; color: #000; font-size: 11px;">${dist.name}</div>
            <div style="font-size: 10px; color: #64748B;">RTO: ${dist.rtoCodes.join(', ')} • ${dist.totalCameras} Feeds</div>
          </div>`,
          { sticky: true, className: 'leaflet-custom-tooltip' }
        );

        polygon.on('click', () => {
          onSelectDistrict(dist.id);
        });

        polygon.addTo(vectorGroup);
      });
    }

    // 2. RENDER REAL ARTERIAL HIGHWAYS (NH-275, NH-44, NICE Road)
    if (showHighways) {
      // NH-275 10-Lane Expressway
      L.polyline(NH275_EXPRESSWAY_WAYPOINTS, {
        color: '#334155',
        weight: 6,
        opacity: 0.5,
      }).addTo(vectorGroup);

      L.polyline(NH275_EXPRESSWAY_WAYPOINTS, {
        color: '#F8FAFC',
        weight: 2,
        dashArray: '6, 6',
        opacity: 0.9,
      }).addTo(vectorGroup);

      // NH-44 Elevated Highway
      L.polyline(NH44_ELEVATED_WAYPOINTS, {
        color: '#475569',
        weight: 4,
        opacity: 0.6,
      }).addTo(vectorGroup);

      // NICE Road Peripheral
      L.polyline(NICE_ROAD_WAYPOINTS, {
        color: '#64748B',
        weight: 3,
        dashArray: '4, 4',
        opacity: 0.5,
      }).addTo(vectorGroup);
    }

    // 3. RENDER REAL ROAD VEHICLE TRANSIT TRAJECTORY (AUTHENTIC HIGHWAY CURVES, NOT A STRAIGHT LINE)
    const originCam = cameras.find((c) => c.id === currentTrajectory.firstSeen.cameraId) || cameras[0];
    const destCam = currentTrajectory.reappearedAt
      ? cameras.find((c) => c.id === currentTrajectory.reappearedAt?.cameraId) || cameras[3]
      : null;

    if (destCam) {
      const oId = originCam.id;
      const dId = destCam.id;
      const forwardKey = `${oId}->${dId}`;
      const reverseKey = `${dId}->${oId}`;

      let routeWaypoints: [number, number][] = [];
      let drivingDistanceKm = currentTrajectory.distanceKm;

      // 1. Check precomputed authentic OSRM road coordinates cache
      const forwardData = (realRoadRoutesData as any)[forwardKey];
      const reverseData = (realRoadRoutesData as any)[reverseKey];

      if (forwardData && Array.isArray(forwardData.points) && forwardData.points.length > 0) {
        routeWaypoints = forwardData.points;
        drivingDistanceKm = forwardData.distance_km || drivingDistanceKm;
      } else if (reverseData && Array.isArray(reverseData.points) && reverseData.points.length > 0) {
        routeWaypoints = [...reverseData.points].reverse();
        drivingDistanceKm = reverseData.distance_km || drivingDistanceKm;
      } else {
        // Fallback to high-density arterial highway waypoint reconstruction
        const wp: [number, number][] = [[originCam.lat, originCam.lng]];
        if (
          (oId === 'CAM-01' || oId === 'CAM-02') &&
          (dId === 'CAM-04' || dId === 'CAM-07' || dId === 'CAM-CRASH' || dId === 'CAM-TT2' || dId === 'CAM-MYS')
        ) {
          const niceWaypoints = (realRoadRoutesData as any).NICE_ROAD || [];
          wp.push(...niceWaypoints);
        }
        if (dId === 'CAM-07' || dId === 'CAM-CRASH' || dId === 'CAM-TT2' || dId === 'CAM-MYS') {
          const expWaypoints = (realRoadRoutesData as any).NH275_EXPRESSWAY || [];
          const closestIdx = expWaypoints.reduce((bestIdx: number, pt: [number, number], idx: number) => {
            const d = Math.hypot(pt[0] - destCam.lat, pt[1] - destCam.lng);
            const bestD = Math.hypot(expWaypoints[bestIdx][0] - destCam.lat, expWaypoints[bestIdx][1] - destCam.lng);
            return d < bestD ? idx : bestIdx;
          }, 0);
          wp.push(...expWaypoints.slice(0, closestIdx + 1));
        }
        wp.push([destCam.lat, destCam.lng]);
        routeWaypoints = wp;
      }

      // Update state for HUD display
      setActiveRouteInfo({
        distanceKm: drivingDistanceKm,
        durationMin: currentTrajectory.durationMinutes,
        pointCount: routeWaypoints.length,
        routeName: `${originCam.id} (${originCam.name.split('-')[0].trim()}) ➔ ${destCam.id} (${destCam.name.split('-')[0].trim()})`,
      });

      // Layer 1: Ambient Outer Neon Halo Glow
      L.polyline(routeWaypoints, {
        color: '#00F0FF',
        weight: 14,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(vectorGroup);

      // Layer 2: Deep Dark Outer Conduit (ensures contrast against satellite/terrain basemaps)
      L.polyline(routeWaypoints, {
        color: '#020617',
        weight: 7,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(vectorGroup);

      // Layer 3: Vibrant Core High-Tech Trajectory Ribbon
      L.polyline(routeWaypoints, {
        color: '#00F0FF',
        weight: 4,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(vectorGroup);

      // Layer 4: High-Contrast Directional Pulsing Center Stripe
      L.polyline(routeWaypoints, {
        color: '#FFFFFF',
        weight: 2,
        dashArray: '8, 12',
        opacity: 0.95,
      }).addTo(vectorGroup);

      // Strategic Road Waypoint Milestone Markers (sampled along the real highway curves)
      if (routeWaypoints.length > 2) {
        const milestoneRatios = [0.20, 0.40, 0.60, 0.80];
        milestoneRatios.forEach((ratio, mIdx) => {
          const sampleIdx = Math.floor(routeWaypoints.length * ratio);
          const pt = routeWaypoints[sampleIdx];
          if (!pt) return;

          const waypointIcon = L.divIcon({
            html: `
              <div class="relative flex items-center justify-center pointer-events-none">
                <div class="w-3.5 h-3.5 rounded-full bg-cyan-400 opacity-60 animate-ping"></div>
                <div class="absolute w-2 h-2 rounded-full bg-white border border-cyan-500 shadow"></div>
                <div class="absolute -top-3.5 whitespace-nowrap bg-black/85 text-cyan-300 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-cyan-500/40 shadow">
                  CHECKPOINT ${mIdx + 1}
                </div>
              </div>
            `,
            className: 'custom-waypoint-dot',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          L.marker(pt, { icon: waypointIcon, interactive: false }).addTo(vectorGroup);
        });
      }

      // Auto-fit bounds with smooth fly
      const bounds = L.latLngBounds(routeWaypoints);
      map.invalidateSize();
      map.flyToBounds(bounds, {
        padding: [60, 60],
        maxZoom: 13,
        duration: 1.2,
      });
    }

    // 4. RENDER REAL CAMERA SURVEILLANCE MARKERS
    if (showCameras) {
      cameras.forEach((cam) => {
        const isOrigin = cam.id === currentTrajectory.firstSeen.cameraId;
        const isDest = cam.id === currentTrajectory.reappearedAt?.cameraId;

        // Create Custom HTML DivIcon
        let markerHtml = '';
        if (isOrigin) {
          markerHtml = `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 rounded-full bg-blue-500 opacity-40 animate-ping"></div>
              <div class="relative w-7 h-7 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
                ${cam.id.replace('CAM-', '')}
              </div>
              <div class="absolute -bottom-5 whitespace-nowrap bg-blue-900 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                ENTRY: ${cam.id}
              </div>
            </div>
          `;
        } else if (isDest) {
          markerHtml = `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 rounded-full bg-emerald-500 opacity-40 animate-ping"></div>
              <div class="relative w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
                ${cam.id.replace('CAM-', '')}
              </div>
              <div class="absolute -bottom-5 whitespace-nowrap bg-emerald-900 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                REAPPEAR: ${cam.id}
              </div>
            </div>
          `;
        } else {
          markerHtml = `
            <div class="relative flex items-center justify-center">
              <div class="w-5 h-5 rounded-full bg-slate-700 border-2 border-white shadow flex items-center justify-center text-white text-[8px] font-bold">
                ${cam.id.replace('CAM-', '')}
              </div>
            </div>
          `;
        }

        const icon = L.divIcon({
          html: markerHtml,
          className: 'custom-camera-div-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([cam.lat, cam.lng], { icon });

        // Popup with rich camera snapshot and specs
        marker.bindPopup(`
          <div style="font-family: Inter, sans-serif; min-width: 220px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 8px;">
              <span style="font-weight: 700; color: #0F172A; font-size: 13px;">${cam.name}</span>
              <span style="font-size: 10px; font-family: monospace; font-weight: 700; background: #000; color: #fff; padding: 2px 6px; rounded: 4px;">${cam.id}</span>
            </div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 4px;">
              <strong>District:</strong> ${cam.districtName}
            </div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
              <strong>Corridor:</strong> ${cam.corridor}
            </div>
            <div style="font-size: 10px; font-family: monospace; color: #2563EB; margin-bottom: 8px;">
              GPS: ${cam.lat}° N, ${cam.lng}° E
            </div>
            <div style="border-radius: 8px; overflow: hidden; background: #000; border: 1px solid #CBD5E1;">
              <img src="${BACKEND_URL}/crops/1_frame2_KA05MR9633.jpg" style="width: 100%; height: 80px; object-fit: cover;" onerror="this.style.display='none'" />
            </div>
          </div>
        `);

        marker.addTo(markersGroup);
      });
    }
  }, [
    currentTrajectory,
    districts,
    cameras,
    activeDistrictId,
    showDistricts,
    showCameras,
    showHighways,
    onSelectDistrict,
  ]);

  const handleRecenterRoute = () => {
    if (!mapInstanceRef.current) return;
    const originCam = cameras.find((c) => c.id === currentTrajectory.firstSeen.cameraId) || cameras[0];
    const destCam = currentTrajectory.reappearedAt
      ? cameras.find((c) => c.id === currentTrajectory.reappearedAt?.cameraId) || cameras[3]
      : null;

    if (destCam) {
      const bounds = L.latLngBounds([
        [originCam.lat, originCam.lng],
        [destCam.lat, destCam.lng],
      ]);
      mapInstanceRef.current.flyToBounds(bounds, { padding: [60, 60], duration: 1.2 });
    } else {
      mapInstanceRef.current.flyTo([originCam.lat, originCam.lng], 12, { duration: 1.2 });
    }
  };

  return (
    <div className="relative w-full h-[540px] sm:h-[600px] lg:h-[640px] bg-slate-950 rounded-3xl overflow-hidden border border-black/15 shadow-md select-none">
      {/* Real Interactive Leaflet Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{ width: '100%', height: '100%', minHeight: '540px', position: 'relative' }}
      />

      {/* Top Floating Bar: Style Switcher & Overlays Controls */}
      <div className="absolute top-4 left-4 right-14 z-[400] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* CARTO Basemap Engine & Style Switcher */}
        <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-black/10 shadow-lg flex items-center gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black text-white text-[11px] font-mono font-semibold tracking-wider uppercase">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>CARTO</span>
          </div>

          {(Object.keys(TILE_LAYERS) as Array<keyof typeof TILE_LAYERS>).map((styleKey) => {
            const isActive = activeTileStyle === styleKey;
            return (
              <button
                key={styleKey}
                onClick={() => setActiveTileStyle(styleKey)}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-black text-white shadow font-bold'
                    : 'text-[#6F6F6F] hover:text-black hover:bg-slate-100'
                }`}
                title={TILE_LAYERS[styleKey].tag}
              >
                {TILE_LAYERS[styleKey].label}
              </button>
            );
          })}

          {/* API Key Status Pill */}
          <button
            onClick={() => setShowApiKeyModal(!showApiKeyModal)}
            className="flex items-center gap-1.5 px-2.5 py-1 ml-0.5 rounded-xl text-[11px] font-mono font-semibold border border-black/10 hover:bg-slate-50 transition-colors cursor-pointer"
            title="CARTO API Key Settings"
          >
            {CARTO_API_KEY ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700">API Key Active</span>
              </>
            ) : (
              <>
                <Key className="w-3 h-3 text-amber-600" />
                <span className="text-amber-800">API Key (.env)</span>
              </>
            )}
          </button>
        </div>

        {/* Layer Toggles & Re-center Action */}
        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-black/10 shadow-lg flex items-center gap-3 pointer-events-auto text-xs font-mono">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={showDistricts}
              onChange={(e) => setShowDistricts(e.target.checked)}
              className="rounded accent-black cursor-pointer"
            />
            Districts
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={showHighways}
              onChange={(e) => setShowHighways(e.target.checked)}
              className="rounded accent-black cursor-pointer"
            />
            Expressways
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={showCameras}
              onChange={(e) => setShowCameras(e.target.checked)}
              className="rounded accent-black cursor-pointer"
            />
            Cameras
          </label>
          <button
            onClick={handleRecenterRoute}
            className="ml-2 pl-2 border-l border-slate-200 text-black hover:text-blue-600 flex items-center gap-1 font-bold cursor-pointer"
            title="Fit Route on Map"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Focus Route
          </button>
        </div>
      </div>

      {/* Real Highway Road Routing HUD Pill */}
      {activeRouteInfo && (
        <div className="absolute top-18 left-4 z-[400] bg-black/90 backdrop-blur-xl border border-cyan-500/50 rounded-2xl px-4 py-2 shadow-2xl text-white pointer-events-auto flex items-center gap-3">
          <div className="relative flex items-center justify-center w-3 h-3">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 opacity-75 animate-ping absolute"></span>
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          </div>
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-300">
            Road Network Route (OSRM)
          </div>
          <div className="h-3.5 w-px bg-white/20"></div>
          <div className="text-xs font-mono text-slate-300 flex items-center gap-2">
            <span>{activeRouteInfo.routeName}</span>
            <span className="text-cyan-400 font-bold">{activeRouteInfo.distanceKm} km</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-medium">{activeRouteInfo.pointCount} Highway Nodes</span>
          </div>
        </div>
      )}

      {/* API Key Modal / Guidance Popup */}
      {showApiKeyModal && (
        <div className="absolute top-16 left-4 z-[450] max-w-sm bg-white/98 backdrop-blur-xl border border-black/15 rounded-3xl p-5 shadow-2xl animate-fade-rise">
          <div className="flex items-center justify-between pb-3 border-b border-black/10">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-black" />
              <span className="font-serif text-sm font-semibold text-black">CARTO Map API Key</span>
            </div>
            <button
              onClick={() => setShowApiKeyModal(false)}
              className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer font-medium"
            >
              Close
            </button>
          </div>
          <div className="mt-3 space-y-2.5 text-xs text-slate-600 font-sans">
            <p>
              To authenticate high-throughput CARTO requests or custom datasets, add your key to:
            </p>
            <code className="block p-2 rounded-xl bg-slate-100 text-black font-mono text-[11px] border border-black/5 break-all">
              frontend/.env<br />
              NEXT_PUBLIC_CARTO_API_KEY=your_key_here
            </code>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700">
              Current Engine Status:{' '}
              {CARTO_API_KEY ? (
                <span className="text-emerald-700 font-bold">Authenticated with Custom API Key</span>
              ) : (
                <span className="text-amber-800 font-bold">Public CDN Basemaps Active (Ready)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Legend & Telemetry Bar */}
      <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-md border border-black/10 rounded-2xl p-3 shadow-lg flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-600 shadow-sm animate-pulse"></span>
          <span className="text-black font-semibold">Origin Sighting</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm animate-ping"></span>
          <span className="text-black font-semibold">Reappearance Toll</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-1.5 bg-cyan-400 border border-black rounded shadow"></span>
          <span className="text-slate-800 font-bold">Target Transit Trajectory</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-5 h-1 bg-slate-400 rounded"></span>
          <span className="text-slate-600">Expressway Corridors</span>
        </div>
      </div>

      {/* Bottom Right Live GPS Coordinates Box */}
      <div className="absolute bottom-4 right-4 z-[400] bg-white/95 backdrop-blur-md border border-black/10 rounded-2xl px-3 py-1.5 shadow-lg text-[11px] font-mono text-slate-600">
        GPS:{' '}
        <span className="text-black font-bold">
          {cursorCoords ? `${cursorCoords.lat}° N, ${cursorCoords.lng}° E` : '12.7214° N, 77.2810° E'}
        </span>
      </div>
    </div>
  );
};
