"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  Search,
  ShieldAlert,
  ArrowRight,
  AlertOctagon,
  ChevronRight,
  Zap,
  MapPin,
  Navigation,
  Car,
} from 'lucide-react';

const RealLeafletDistrictMap = dynamic(
  () => import('./RealLeafletDistrictMap').then((m) => m.RealLeafletDistrictMap),
  { ssr: false }
);

import { BACKEND_URL } from '@/lib/config';
const resolvePhotoUrl = (url?: string) => {
  if (!url) return '';
  const filename = url.split('/').pop();
  return `/crops/${filename}`;
};

interface GpsTransitMapPageProps {
  onBackToDashboard: () => void;
  initialPlate?: string;
  initialSection?: 'map' | 'blacklist';
}

export interface DistrictInfo {
  id: string;
  name: string;
  rtoCodes: string[];
  headquarters: string;
  totalCameras: number;
  center: { x: number; y: number }; // percentage on SVG
  pathD: string; // SVG path boundary
  color: string;
}

export interface CameraNode {
  id: string;
  name: string;
  districtId: string;
  districtName: string;
  corridor: string;
  lat: number;
  lng: number;
  x: number; // percentage in SVG coordinate space
  y: number; // percentage in SVG coordinate space
  status: 'ACTIVE' | 'CALIBRATING';
}

export interface TransitTrajectory {
  plate: string;
  vehicleModel: string;
  vehicleType: string;
  originDistrict: string;
  destinationDistrict: string;
  highwayCorridor: string;
  distanceKm: number;
  durationMinutes: number;
  avgSpeedKmh: number;
  transitHeading: string;
  firstSeen: {
    cameraId: string;
    cameraName: string;
    districtId: string;
    districtName: string;
    timestamp: string;
    speedKmh: number;
    photoVehicle: string;
    photoPlate: string;
    photoLabel1: string;
    photoLabel2: string;
  };
  reappearedAt?: {
    cameraId: string;
    cameraName: string;
    districtId: string;
    districtName: string;
    timestamp: string;
    speedKmh: number;
    photoVehicle: string;
    photoPlate: string;
    photoLabel1: string;
    photoLabel2: string;
  };
}

export interface BlockedVehicleRecord {
  id: string;
  plate: string;
  vehicleModel: string;
  state: string;
  severity: 'CRITICAL_WANTED' | 'STOLEN_ALERT' | 'SEIZED_COURT_ORDER';
  severityLabel: string;
  violationReason: string;
  caseNumber: string;
  originDistrict: string;
  reappearDistrict: string;
  whereAppeared: string;
  firstSeenTime: string;
  reappearedAt: string;
  reappearTime: string;
  photoVehicle: string;
  photoPlate: string;
  actionTaken: string;
}

// Karnataka & Southern Arterial Corridor Districts
export const KARNATAKA_DISTRICTS: DistrictInfo[] = [
  {
    id: 'bengaluru-urban',
    name: 'Bengaluru Urban District',
    rtoCodes: ['KA01', 'KA02', 'KA03', 'KA04', 'KA05', 'KA51', 'KA53'],
    headquarters: 'Bengaluru City',
    totalCameras: 4,
    center: { x: 62, y: 38 },
    pathD: 'M 52 24 L 74 22 L 78 44 L 66 54 L 50 48 Z',
    color: '#3B82F6',
  },
  {
    id: 'ramanagara',
    name: 'Ramanagara District',
    rtoCodes: ['KA42'],
    headquarters: 'Ramanagara',
    totalCameras: 2,
    center: { x: 44, y: 46 },
    pathD: 'M 36 34 L 52 24 L 50 48 L 42 62 L 32 50 Z',
    color: '#8B5CF6',
  },
  {
    id: 'mandya',
    name: 'Mandya District',
    rtoCodes: ['KA11', 'KA54'],
    headquarters: 'Mandya City',
    totalCameras: 2,
    center: { x: 30, y: 60 },
    pathD: 'M 22 48 L 36 34 L 42 62 L 34 76 L 18 68 Z',
    color: '#10B981',
  },
  {
    id: 'mysuru',
    name: 'Mysuru (Mysore) District',
    rtoCodes: ['KA09', 'KA55'],
    headquarters: 'Mysuru City',
    totalCameras: 2,
    center: { x: 22, y: 78 },
    pathD: 'M 14 66 L 34 76 L 30 92 L 10 90 L 8 76 Z',
    color: '#F59E0B',
  },
  {
    id: 'tumakuru',
    name: 'Tumakuru District',
    rtoCodes: ['KA06', 'KA44'],
    headquarters: 'Tumakuru',
    totalCameras: 1,
    center: { x: 42, y: 16 },
    pathD: 'M 30 10 L 54 8 L 52 24 L 36 34 L 26 22 Z',
    color: '#EC4899',
  },
  {
    id: 'kolar',
    name: 'Kolar District',
    rtoCodes: ['KA07', 'KA08'],
    headquarters: 'Kolar',
    totalCameras: 1,
    center: { x: 84, y: 32 },
    pathD: 'M 74 22 L 94 20 L 92 44 L 78 44 Z',
    color: '#06B6D4',
  },
  {
    id: 'dakshina-kannada',
    name: 'Dakshina Kannada District',
    rtoCodes: ['KA19', 'KA20', 'KA21'],
    headquarters: 'Mangaluru',
    totalCameras: 1,
    center: { x: 12, y: 40 },
    pathD: 'M 2 26 L 18 24 L 20 54 L 4 52 Z',
    color: '#6366F1',
  },
];

// High-fidelity Camera Surveillance Nodes with District Association & Real GPS
export const DISTRICT_CAMERAS: CameraNode[] = [
  {
    id: 'CAM-01',
    name: 'Silk Board - Hosur Corridor',
    districtId: 'bengaluru-urban',
    districtName: 'Bengaluru Urban District',
    corridor: 'Outer Ring Road / NH-44 South',
    lat: 12.9172,
    lng: 77.6228,
    x: 60,
    y: 35,
    status: 'ACTIVE',
  },
  {
    id: 'CAM-02',
    name: 'Electronic City Toll Plaza',
    districtId: 'bengaluru-urban',
    districtName: 'Bengaluru Urban District',
    corridor: 'Elevated Toll Highway / NH-44',
    lat: 12.8452,
    lng: 77.6602,
    x: 67,
    y: 44,
    status: 'ACTIVE',
  },
  {
    id: 'CAM-04',
    name: 'Kengeri NICE Interchange',
    districtId: 'bengaluru-urban',
    districtName: 'Bengaluru Urban District',
    corridor: 'NICE Peripheral Expressway & NH-275 Entry',
    lat: 12.9081,
    lng: 77.4875,
    x: 54,
    y: 39,
    status: 'ACTIVE',
  },
  {
    id: 'CAM-CRASH',
    name: 'Ramanagara Expressway Toll',
    districtId: 'ramanagara',
    districtName: 'Ramanagara District',
    corridor: 'Bengaluru - Mysuru 10-Lane Expressway (NH-275)',
    lat: 12.7214,
    lng: 77.281,
    x: 43,
    y: 49,
    status: 'ACTIVE',
  },
  {
    id: 'CAM-TT2',
    name: 'Mandya Bypass Corridor',
    districtId: 'mandya',
    districtName: 'Mandya District',
    corridor: 'NH-275 Mandya Arterial Bypass',
    lat: 12.5244,
    lng: 76.8969,
    x: 31,
    y: 63,
    status: 'ACTIVE',
  },
  {
    id: 'CAM-MYS',
    name: 'Mysuru Columbia Asia Toll',
    districtId: 'mysuru',
    districtName: 'Mysuru (Mysore) District',
    corridor: 'Mysuru Ring Road & Bengaluru-Mysuru Expressway Terminus',
    lat: 12.3375,
    lng: 76.6578,
    x: 21,
    y: 80,
    status: 'ACTIVE',
  },
  {
    id: 'CAM-ARMY',
    name: 'Defence Corridor Transit',
    districtId: 'bengaluru-urban',
    districtName: 'Bengaluru Urban District',
    corridor: 'ASC Center North Perimeter',
    lat: 13.0012,
    lng: 77.589,
    x: 61,
    y: 28,
    status: 'ACTIVE',
  },
  {
    id: 'CAM-07',
    name: 'Bidadi - Ramanagara Expressway Gantry',
    districtId: 'ramanagara',
    districtName: 'Ramanagara District',
    corridor: 'Bengaluru - Mysuru Expressway (NH-275)',
    lat: 12.7650,
    lng: 77.3450,
    x: 48,
    y: 44,
    status: 'ACTIVE',
  },
];

// District Trajectories Matching Available Dataset
export const DISTRICT_TRAJECTORIES: Record<string, TransitTrajectory> = {
  AJ13LVN: {
    plate: 'AJ13LVN',
    vehicleModel: 'Executive Sedan (Silver Grey)',
    vehicleType: 'Highway Patrol Verified Vehicle',
    originDistrict: 'Bengaluru Urban District',
    destinationDistrict: 'Ramanagara District',
    highwayCorridor: 'Bengaluru-Mysuru 10-Lane Expressway (NH-275)',
    distanceKm: 24.97,
    durationMinutes: 22.0,
    avgSpeedKmh: 68.1,
    transitHeading: 'South-West (235°)',
    firstSeen: {
      cameraId: 'CAM-04',
      cameraName: 'Kengeri NICE Interchange',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '10:45:12 AM',
      speedKmh: 65.4,
      photoVehicle: '/crops/15698741_2160_3840_30fps_frame6_AJ13LVN.jpg',
      photoPlate: '/crops/15698741_2160_3840_30fps_plate_AJ13LVN.jpg',
      photoLabel1: 'Photo 1: Kengeri Express Entry',
      photoLabel2: 'Photo 2: Registered Plate Optical Crop',
    },
    reappearedAt: {
      cameraId: 'CAM-07',
      cameraName: 'Bidadi - Ramanagara Expressway Gantry',
      districtId: 'ramanagara',
      districtName: 'Ramanagara District',
      timestamp: '11:07:12 AM',
      speedKmh: 72.8,
      photoVehicle: '/crops/15698741_2160_3840_30fps_frame6_AJ13LVN.jpg',
      photoPlate: '/crops/15698741_2160_3840_30fps_plate_AJ13LVN.jpg',
      photoLabel1: 'Photo 1: Expressway Gantry Reappearance',
      photoLabel2: 'Photo 2: Telemetry Capture Snapshot',
    },
  },
  AJI3LVN: {
    plate: 'AJ13LVN',
    vehicleModel: 'Executive Sedan (Silver Grey)',
    vehicleType: 'Highway Patrol Verified Vehicle',
    originDistrict: 'Bengaluru Urban District',
    destinationDistrict: 'Ramanagara District',
    highwayCorridor: 'Bengaluru-Mysuru 10-Lane Expressway (NH-275)',
    distanceKm: 24.97,
    durationMinutes: 22.0,
    avgSpeedKmh: 68.1,
    transitHeading: 'South-West (235°)',
    firstSeen: {
      cameraId: 'CAM-04',
      cameraName: 'Kengeri NICE Interchange',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '10:45:12 AM',
      speedKmh: 65.4,
      photoVehicle: '/crops/15698741_2160_3840_30fps_frame6_AJ13LVN.jpg',
      photoPlate: '/crops/15698741_2160_3840_30fps_plate_AJ13LVN.jpg',
      photoLabel1: 'Photo 1: Kengeri Express Entry',
      photoLabel2: 'Photo 2: Registered Plate Optical Crop',
    },
    reappearedAt: {
      cameraId: 'CAM-07',
      cameraName: 'Bidadi - Ramanagara Expressway Gantry',
      districtId: 'ramanagara',
      districtName: 'Ramanagara District',
      timestamp: '11:07:12 AM',
      speedKmh: 72.8,
      photoVehicle: '/crops/15698741_2160_3840_30fps_frame6_AJ13LVN.jpg',
      photoPlate: '/crops/15698741_2160_3840_30fps_plate_AJ13LVN.jpg',
      photoLabel1: 'Photo 1: Expressway Gantry Reappearance',
      photoLabel2: 'Photo 2: Telemetry Capture Snapshot',
    },
  },
  KA05MR9633: {
    plate: 'KA05MR9633',
    vehicleModel: 'Hyundai Creta (White)',
    vehicleType: 'Private SUV',
    originDistrict: 'Bengaluru Urban District',
    destinationDistrict: 'Bengaluru Urban (Electronic City Sector)',
    highwayCorridor: 'NH-44 Elevated Expressway',
    distanceKm: 14.8,
    durationMinutes: 18.2,
    avgSpeedKmh: 48.7,
    transitHeading: 'South-South-East (160°)',
    firstSeen: {
      cameraId: 'CAM-01',
      cameraName: 'Silk Board - Hosur Corridor',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '09:14:10 AM',
      speedKmh: 42.5,
      photoVehicle: 'http://127.0.0.1:8000/crops/1_frame2_KA05MR9633.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/1_frame350_KA05MR9633.jpg',
      photoLabel1: 'Photo 1: Silk Board Entry Sighting',
      photoLabel2: 'Photo 2: High-Resolution Plate Crop',
    },
    reappearedAt: {
      cameraId: 'CAM-02',
      cameraName: 'Electronic City Toll Plaza',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '09:32:22 AM',
      speedKmh: 64.1,
      photoVehicle: 'http://127.0.0.1:8000/crops/2_frame46_KA05MR9633.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/2_frame46_KA05MR9633.jpg',
      photoLabel1: 'Photo 1: Toll Gate Reappearance',
      photoLabel2: 'Photo 2: Toll Verification Snapshot',
    },
  },
  KA09Z4433: {
    plate: 'KA09Z4433',
    vehicleModel: 'Maruti Suzuki Swift Dzire (Silver)',
    vehicleType: 'Commercial Sedan',
    originDistrict: 'Bengaluru Urban District',
    destinationDistrict: 'Ramanagara District',
    highwayCorridor: 'Bengaluru-Mysuru 10-Lane Expressway (NH-275)',
    distanceKm: 41.2,
    durationMinutes: 28.5,
    avgSpeedKmh: 86.7,
    transitHeading: 'South-West (235°)',
    firstSeen: {
      cameraId: 'CAM-04',
      cameraName: 'Kengeri NICE Interchange',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '11:05:40 AM',
      speedKmh: 58.0,
      photoVehicle: 'http://127.0.0.1:8000/crops/2_frame375_KA09Z4433.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/crash_frame375_KA09Z4433.jpg',
      photoLabel1: 'Photo 1: Kengeri Express Entry',
      photoLabel2: 'Photo 2: OCR Extraction Sighting',
    },
    reappearedAt: {
      cameraId: 'CAM-CRASH',
      cameraName: 'Ramanagara Expressway Toll',
      districtId: 'ramanagara',
      districtName: 'Ramanagara District',
      timestamp: '11:34:10 AM',
      speedKmh: 89.2,
      photoVehicle: 'http://127.0.0.1:8000/crops/crash_frame440_KA09Z4433.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/crash_frame375_KA09Z4433.jpg',
      photoLabel1: 'Photo 1: Ramanagara Reappearance',
      photoLabel2: 'Photo 2: Incident Location Verification',
    },
  },
  KA51AF5156: {
    plate: 'KA51AF5156',
    vehicleModel: 'Toyota Innova Crysta (Grey)',
    vehicleType: 'Private MPV',
    originDistrict: 'Bengaluru Urban District',
    destinationDistrict: 'Ramanagara District',
    highwayCorridor: 'NH-275 Express Corridor',
    distanceKm: 38.6,
    durationMinutes: 26.0,
    avgSpeedKmh: 89.0,
    transitHeading: 'South-West (240°)',
    firstSeen: {
      cameraId: 'CAM-02',
      cameraName: 'Electronic City Toll Plaza',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '11:12:05 AM',
      speedKmh: 62.0,
      photoVehicle: 'http://127.0.0.1:8000/crops/2_frame5_KA51AF5156.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/crash_frame5_KA51AF5156.jpg',
      photoLabel1: 'Photo 1: Electronic City Perimeter',
      photoLabel2: 'Photo 2: Plate Confirmation Crop',
    },
    reappearedAt: {
      cameraId: 'CAM-CRASH',
      cameraName: 'Ramanagara Expressway Toll',
      districtId: 'ramanagara',
      districtName: 'Ramanagara District',
      timestamp: '11:38:05 AM',
      speedKmh: 84.4,
      photoVehicle: 'http://127.0.0.1:8000/crops/crash_frame45_KA51AF5156.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/crash_frame45_KA51AF5156.jpg',
      photoLabel1: 'Photo 1: Ramanagara Reappearance',
      photoLabel2: 'Photo 2: Telemetry Capture',
    },
  },
  KA05NC5241: {
    plate: 'KA05NC5241',
    vehicleModel: 'Mahindra Scorpio-N (Black)',
    vehicleType: 'Commercial SUV',
    originDistrict: 'Bengaluru Urban District',
    destinationDistrict: 'Bengaluru Urban (Electronic City Sector)',
    highwayCorridor: 'Outer Ring Road / Silk Board Corridor',
    distanceKm: 12.3,
    durationMinutes: 16.5,
    avgSpeedKmh: 44.7,
    transitHeading: 'South (180°)',
    firstSeen: {
      cameraId: 'CAM-04',
      cameraName: 'Kengeri NICE Interchange',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '08:45:10 AM',
      speedKmh: 38.5,
      photoVehicle: 'http://127.0.0.1:8000/crops/1_frame10_KA05NC5241.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/1_frame70_KA05NC5241.jpg',
      photoLabel1: 'Photo 1: Interchange Camera Sighting',
      photoLabel2: 'Photo 2: Registered Plate Optical Crop',
    },
    reappearedAt: {
      cameraId: 'CAM-02',
      cameraName: 'Electronic City Toll Plaza',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '09:01:40 AM',
      speedKmh: 52.0,
      photoVehicle: 'http://127.0.0.1:8000/crops/2_frame10_KA05NC5241.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/2_frame10_KA05NC5241.jpg',
      photoLabel1: 'Photo 1: Electronic City Sighting',
      photoLabel2: 'Photo 2: Standard Verification Crop',
    },
  },
  KA21C5074: {
    plate: 'KA21C5074',
    vehicleModel: 'Honda City (Dark Blue)',
    vehicleType: 'Private Sedan (Dakshina Kannada Registered)',
    originDistrict: 'Bengaluru Urban District',
    destinationDistrict: 'Ramanagara District',
    highwayCorridor: 'NICE Road to NH-275 Express Corridor',
    distanceKm: 36.5,
    durationMinutes: 24.2,
    avgSpeedKmh: 90.4,
    transitHeading: 'South-West (230°)',
    firstSeen: {
      cameraId: 'CAM-04',
      cameraName: 'Kengeri NICE Interchange',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '11:15:00 AM',
      speedKmh: 60.0,
      photoVehicle: 'http://127.0.0.1:8000/crops/2_frame395_KA21C5074.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/crash_frame395_KA21C5074.jpg',
      photoLabel1: 'Photo 1: Kengeri Corridor Capture',
      photoLabel2: 'Photo 2: Coastal Plate KA21 Verification',
    },
    reappearedAt: {
      cameraId: 'CAM-CRASH',
      cameraName: 'Ramanagara Expressway Toll',
      districtId: 'ramanagara',
      districtName: 'Ramanagara District',
      timestamp: '11:39:12 AM',
      speedKmh: 88.5,
      photoVehicle: 'http://127.0.0.1:8000/crops/crash_frame580_KA21C5074.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/crash_frame395_KA21C5074.jpg',
      photoLabel1: 'Photo 1: Expressway Toll Spotting',
      photoLabel2: 'Photo 2: Optical Verification Crop',
    },
  },
  JK5098: {
    plate: 'JK5098',
    vehicleModel: 'Royal Enfield Bullet 350 (Black)',
    vehicleType: 'Vintage Two-Wheeler (Jammu & Kashmir)',
    originDistrict: 'Bengaluru Urban District',
    destinationDistrict: 'Bengaluru Urban (Electronic City Sector)',
    highwayCorridor: 'Hosur Main Road Arterial Transit',
    distanceKm: 15.1,
    durationMinutes: 22.0,
    avgSpeedKmh: 41.2,
    transitHeading: 'South-South-East (165°)',
    firstSeen: {
      cameraId: 'CAM-01',
      cameraName: 'Silk Board - Hosur Corridor',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '10:04:12 AM',
      speedKmh: 35.0,
      photoVehicle: 'http://127.0.0.1:8000/crops/1_frame432_JK5098.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/2_frame375_JK5098.jpg',
      photoLabel1: 'Photo 1: Silk Board Entry Sighting',
      photoLabel2: 'Photo 2: 2-Wheeler Plate Confirmation',
    },
    reappearedAt: {
      cameraId: 'CAM-02',
      cameraName: 'Electronic City Toll Plaza',
      districtId: 'bengaluru-urban',
      districtName: 'Bengaluru Urban District',
      timestamp: '10:26:12 AM',
      speedKmh: 45.0,
      photoVehicle: 'http://127.0.0.1:8000/crops/2_frame432_JK5098.jpg',
      photoPlate: 'http://127.0.0.1:8000/crops/2_frame375_JK5098.jpg',
      photoLabel1: 'Photo 1: Electronic City Toll Sighting',
      photoLabel2: 'Photo 2: Secondary Optical Verification',
    },
  },
};

// Blocked / Wanted Vehicles with Inter-District Sighting History
export const BLOCKED_VEHICLES_DATA: BlockedVehicleRecord[] = [
  {
    id: 'BLK-001',
    plate: 'KA09Z4433',
    vehicleModel: 'Maruti Suzuki Swift Dzire (Silver)',
    state: 'Karnataka (Mysuru RTO)',
    severity: 'CRITICAL_WANTED',
    severityLabel: 'HIGH SPEED HIT & RUN / COURT WARRANT',
    violationReason:
      'Involved in multi-vehicle pileup on NH-275 Expressway. Driver fled scene. High-priority judicial seizure warrant active.',
    caseNumber: 'FIR #891/2026 / Ramanagara Traffic PS',
    originDistrict: 'Bengaluru Urban District',
    reappearDistrict: 'Ramanagara District',
    whereAppeared: 'CAM-04 (Kengeri NICE Interchange)',
    firstSeenTime: '11:05:40 AM',
    reappearedAt: 'CAM-CRASH (Ramanagara Expressway Toll)',
    reappearTime: '11:34:10 AM',
    photoVehicle: 'http://127.0.0.1:8000/crops/crash_frame440_KA09Z4433.jpg',
    photoPlate: 'http://127.0.0.1:8000/crops/crash_frame375_KA09Z4433.jpg',
    actionTaken: 'Inter-District Highway Patrol Dispatched • Toll Barrier Block Triggered',
  },
  {
    id: 'BLK-002',
    plate: 'KA05MR9633',
    vehicleModel: 'Hyundai Creta (White)',
    state: 'Karnataka (Bengaluru South RTO)',
    severity: 'STOLEN_ALERT',
    severityLabel: 'STOLEN VEHICLE HOTLIST ALERT',
    violationReason:
      'Vehicle reported stolen from Koramangala 4th Block residence at 03:00 AM. RFID tag tampered.',
    caseNumber: 'FIR #442/2026 / Koramangala Police Station',
    originDistrict: 'Bengaluru Urban District',
    reappearDistrict: 'Bengaluru Urban (Electronic City Sector)',
    whereAppeared: 'CAM-01 (Silk Board - Hosur Corridor)',
    firstSeenTime: '09:14:10 AM',
    reappearedAt: 'CAM-02 (Electronic City Toll Plaza)',
    reappearTime: '09:32:22 AM',
    photoVehicle: 'http://127.0.0.1:8000/crops/1_frame2_KA05MR9633.jpg',
    photoPlate: 'http://127.0.0.1:8000/crops/2_frame46_KA05MR9633.jpg',
    actionTaken: 'Electronic City Toll FastTag Blacklisted • Intercept Unit Alerted',
  },
  {
    id: 'BLK-003',
    plate: 'KA51AF5156',
    vehicleModel: 'Toyota Innova Crysta (Grey)',
    state: 'Karnataka (Electronic City RTO)',
    severity: 'SEIZED_COURT_ORDER',
    severityLabel: 'JUDICIAL SEIZURE ORDER • BANNED TRANSIT',
    violationReason:
      'Debts Recovery Tribunal attachment order for non-compliance. Banned from commercial inter-state arterial highways.',
    caseNumber: 'DRT Order #B-902/2025 / Bengaluru City Civil Court',
    originDistrict: 'Bengaluru Urban District',
    reappearDistrict: 'Ramanagara District',
    whereAppeared: 'CAM-02 (Electronic City Toll Plaza)',
    firstSeenTime: '11:12:05 AM',
    reappearedAt: 'CAM-CRASH (Ramanagara Expressway Toll)',
    reappearTime: '11:38:05 AM',
    photoVehicle: 'http://127.0.0.1:8000/crops/2_frame5_KA51AF5156.jpg',
    photoPlate: 'http://127.0.0.1:8000/crops/crash_frame45_KA51AF5156.jpg',
    actionTaken: 'Revenue Recovery Officer Notified • Impound Unit Assigned',
  },
  {
    id: 'BLK-004',
    plate: 'KA21C5074',
    vehicleModel: 'Honda City (Dark Blue)',
    state: 'Karnataka (Puttur / Dakshina Kannada)',
    severity: 'CRITICAL_WANTED',
    severityLabel: 'CONTRABAND TRANSIT SUSPECT',
    violationReason:
      'Coastline inter-district intelligence alert. Vehicle flagged for illicit interstate cargo transport.',
    caseNumber: 'Alert #NCB-SZN-1108 / Narcotics Control Bureau',
    originDistrict: 'Bengaluru Urban District',
    reappearDistrict: 'Ramanagara District',
    whereAppeared: 'CAM-04 (Kengeri NICE Interchange)',
    firstSeenTime: '11:15:00 AM',
    reappearedAt: 'CAM-CRASH (Ramanagara Expressway Toll)',
    reappearTime: '11:39:12 AM',
    photoVehicle: 'http://127.0.0.1:8000/crops/2_frame395_KA21C5074.jpg',
    photoPlate: 'http://127.0.0.1:8000/crops/crash_frame395_KA21C5074.jpg',
    actionTaken: 'Inter-District Checkpost Lockdown Order Issued',
  },
];

export const GpsTransitMapPage: React.FC<GpsTransitMapPageProps> = ({
  onBackToDashboard,
  initialPlate = 'KA05MR9633',
  initialSection = 'map',
}) => {
  const router = useRouter();

  const [searchPlateInput, setSearchPlateInput] = useState<string>(initialPlate);
  const [activePlate, setActivePlate] = useState<string>(initialPlate);
  const [activeDistrictFilter, setActiveDistrictFilter] = useState<string>('all');

  useEffect(() => {
    if (initialPlate) {
      setActivePlate(initialPlate);
      setSearchPlateInput(initialPlate);
    }
  }, [initialPlate]);

  // Clean registration number
  const cleanPlate = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const currentTrajectory =
    DISTRICT_TRAJECTORIES[cleanPlate(activePlate)] || DISTRICT_TRAJECTORIES['KA05MR9633'];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanPlate(searchPlateInput);
    if (!cleaned) return;

    if (DISTRICT_TRAJECTORIES[cleaned]) {
      setActivePlate(cleaned);
      return;
    }

    // Fuzzy matching for optical substitutions (I<->1, O<->0, etc.)
    const normalized = cleaned
      .replace(/I/g, '1')
      .replace(/L/g, '1')
      .replace(/O/g, '0')
      .replace(/Q/g, '0')
      .replace(/D/g, '0')
      .replace(/Z/g, '2')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/G/g, '6')
      .replace(/U/g, 'V');

    for (const key of Object.keys(DISTRICT_TRAJECTORIES)) {
      const normKey = key
        .replace(/I/g, '1')
        .replace(/L/g, '1')
        .replace(/O/g, '0')
        .replace(/Q/g, '0')
        .replace(/D/g, '0')
        .replace(/Z/g, '2')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
        .replace(/G/g, '6')
        .replace(/U/g, 'V');

      if (normKey === normalized || normKey.includes(normalized) || normalized.includes(normKey)) {
        setActivePlate(key);
        return;
      }
    }

    setActivePlate('KA05MR9633');
  };

  const handleSelectChip = (plate: string) => {
    setSearchPlateInput(plate);
    setActivePlate(plate);
  };

  // EXCLUSIVE MAP ROUTE VIEW (http://localhost:3001/dashboard/map)
  return (
    <div className="w-full pb-20">
      {/* Editorial Header */}
      <div className="relative w-full bg-white border-b border-black/10 pt-10 pb-8">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-black/10 bg-white/80 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-[#6F6F6F]">
                Live District Surveillance Mesh • 7 Jurisdictions Mapped
              </span>
            </div>
          </div>

          <h1
            className="font-serif text-3xl sm:text-5xl md:text-6xl font-normal text-[#000000] tracking-tight leading-[1.05] max-w-5xl"
            style={{ letterSpacing: "-1.5px" }}
          >
            District Trajectory &amp;{" "}
            <span className="italic text-[#6F6F6F]">Cross-Perimeter Intelligence.</span>
          </h1>

          <p className="max-w-3xl mt-4 text-sm sm:text-base leading-relaxed text-[#6F6F6F]">
            Reconstruct vehicle movements across administrative district boundaries, state expressways,
            and inter-district toll corridors. Locate where each registration appeared first, track its
            inter-district transit velocity, and confirm its subsequent reappearance with optical proof.
          </p>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-black/10">
            <div>
              <div className="font-serif text-2xl sm:text-3xl font-normal text-[#000000]">7</div>
              <div className="text-xs text-[#6F6F6F] uppercase tracking-wider mt-1">Districts Mapped</div>
            </div>
            <div>
              <div className="font-serif text-2xl sm:text-3xl font-normal text-[#000000]">NH-275 / 44</div>
              <div className="text-xs text-[#6F6F6F] uppercase tracking-wider mt-1">Express Corridors</div>
            </div>
            <div>
              <div className="font-serif text-2xl sm:text-3xl font-normal text-[#000000]">7 Nodes</div>
              <div className="text-xs text-[#6F6F6F] uppercase tracking-wider mt-1">Perimeter Feeds</div>
            </div>
            <div>
              <div className="font-serif text-2xl sm:text-3xl font-normal text-[#000000]">100%</div>
              <div className="text-xs text-[#6F6F6F] uppercase tracking-wider mt-1">Standard Format OCR</div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Plate Search & Quick Preset Bar */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 -mt-6 relative z-20">
        <div className="bg-white/95 backdrop-blur-xl border border-black/10 rounded-3xl p-6 shadow-xl">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6F6F6F]" />
              <input
                type="text"
                value={searchPlateInput}
                onChange={(e) => setSearchPlateInput(e.target.value)}
                placeholder="Enter License Plate Number (e.g., AJ13LVN, KA05MR9633, KA09Z4433, KA51AF5156, KA21C5074)..."
                className="w-full pl-12 pr-4 py-3.5 bg-[#F9FAFB] border border-black/15 rounded-2xl text-[#000000] placeholder-[#6F6F6F] focus:outline-none focus:border-black focus:ring-1 focus:ring-black text-sm font-mono tracking-wider transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#000000] hover:scale-[1.03] active:scale-[0.98] text-[#FFFFFF] font-medium text-sm transition-transform duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              Trace Trajectory
            </button>
          </form>

          {/* Quick Select Preset Vehicle Chips */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-black/10">
            <span className="text-xs text-[#6F6F6F] flex items-center gap-1.5 font-medium mr-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Presets:
            </span>
            {Array.from(new Set(Object.values(DISTRICT_TRAJECTORIES).map((t) => t.plate))).map((p) => {
              const isSelected = cleanPlate(activePlate) === p || (p === 'AJ13LVN' && cleanPlate(activePlate) === 'AJI3LVN');
              return (
                <button
                  key={p}
                  onClick={() => handleSelectChip(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-[#000000] text-[#FFFFFF] shadow-sm'
                      : 'bg-[#F3F4F6] text-[#6F6F6F] hover:bg-[#E5E7EB] hover:text-[#000000]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* DISTRICT-LEVEL GEOGRAPHICAL MAP SECTION */}
      <div id="district-map-section" className="max-w-7xl mx-auto px-6 sm:px-8 mt-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#6F6F6F] mb-1">
              Geographical Surveillance Mesh
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#000000] font-normal tracking-tight">
              District Boundary &amp; Arterial Expressway Mapping
            </h2>
            <p className="text-sm text-[#6F6F6F] mt-1 max-w-2xl">
              Authentic district boundaries across Karnataka &amp; transit corridors (NH-275, NH-44).
              Hover or click districts to inspect active perimeter cameras and road corridors.
            </p>
          </div>

          {/* District Filter Buttons */}
          <div className="flex flex-wrap gap-1.5 bg-[#F3F4F6] p-1.5 rounded-2xl border border-black/5">
            <button
              onClick={() => setActiveDistrictFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeDistrictFilter === 'all'
                  ? 'bg-white text-black shadow-sm font-semibold'
                  : 'text-[#6F6F6F] hover:text-black'
              }`}
            >
              All Districts
            </button>
            {KARNATAKA_DISTRICTS.map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveDistrictFilter(d.id)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeDistrictFilter === d.id
                    ? 'bg-white text-black shadow-sm font-semibold'
                    : 'text-[#6F6F6F] hover:text-black'
                }`}
              >
                {d.name.replace(' District', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Map & Telemetry 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Real Interactive Geographical District Map (Leaflet) */}
          <div className="lg:col-span-8">
            <RealLeafletDistrictMap
              currentTrajectory={currentTrajectory}
              districts={KARNATAKA_DISTRICTS}
              cameras={DISTRICT_CAMERAS}
              activeDistrictId={activeDistrictFilter}
              onSelectDistrict={(distId) =>
                setActiveDistrictFilter(distId === activeDistrictFilter ? 'all' : distId)
              }
            />
          </div>

          {/* Right Column: Trajectory Telemetry & District Transit Stats */}
          <div className="lg:col-span-4 space-y-4">
            {/* Vehicle Profile Card */}
            <div className="bg-[#F9FAFB] border border-black/10 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-[#6F6F6F]">
                  Target Profile
                </span>
                <span className="px-2.5 py-1 rounded-full bg-black text-white text-[11px] font-mono font-bold">
                  {currentTrajectory.plate}
                </span>
              </div>
              <div className="font-serif text-2xl text-[#000000] font-normal leading-tight">
                {currentTrajectory.vehicleModel}
              </div>
              <div className="text-xs text-[#6F6F6F] mt-1">{currentTrajectory.vehicleType}</div>

              {/* Transit Corridor Specs */}
              <div className="mt-6 space-y-3 pt-4 border-t border-black/10 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#6F6F6F]">Highway Corridor:</span>
                  <span className="font-mono font-semibold text-black">{currentTrajectory.highwayCorridor}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6F6F6F]">Transit Distance:</span>
                  <span className="font-mono font-semibold text-black">{currentTrajectory.distanceKm} km</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6F6F6F]">Travel Duration:</span>
                  <span className="font-mono font-semibold text-black">{currentTrajectory.durationMinutes} minutes</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6F6F6F]">Estimated Velocity:</span>
                  <span className="font-mono font-bold text-black">{currentTrajectory.avgSpeedKmh} km/h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6F6F6F]">Transit Compass Heading:</span>
                  <span className="font-mono font-semibold text-black">{currentTrajectory.transitHeading}</span>
                </div>
              </div>
            </div>

            {/* Origin District Sighting Card */}
            <div className="bg-white border-2 border-blue-100 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-blue-700 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  Origin Appearance
                </span>
                <span className="text-xs font-mono text-[#6F6F6F]">
                  {currentTrajectory.firstSeen.timestamp}
                </span>
              </div>
              <div className="font-serif text-lg font-normal text-black">
                {currentTrajectory.firstSeen.districtName}
              </div>
              <div className="text-xs text-[#6F6F6F] mt-0.5">
                Camera: <span className="font-mono font-semibold text-black">{currentTrajectory.firstSeen.cameraName}</span>
              </div>
              <div className="text-[11px] font-mono text-blue-600 mt-2 font-medium">
                Speed at Perimeter: {currentTrajectory.firstSeen.speedKmh} km/h
              </div>
            </div>

            {/* Subsequent Reappearance District Card */}
            {currentTrajectory.reappearedAt ? (
              <div className="bg-white border-2 border-emerald-100 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-700 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    Reappearance Sighting
                  </span>
                  <span className="text-xs font-mono text-[#6F6F6F]">
                    {currentTrajectory.reappearedAt.timestamp}
                  </span>
                </div>
                <div className="font-serif text-lg font-normal text-black">
                  {currentTrajectory.reappearedAt.districtName}
                </div>
                <div className="text-xs text-[#6F6F6F] mt-0.5">
                  Camera:{' '}
                  <span className="font-mono font-semibold text-black">
                    {currentTrajectory.reappearedAt.cameraName}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-emerald-600 mt-2 font-medium">
                  Speed at Toll Gate: {currentTrajectory.reappearedAt.speedKmh} km/h
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-3xl bg-[#F9FAFB] border border-black/10 text-center text-xs text-[#6F6F6F]">
                No secondary reappearance recorded for this vehicle.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DUAL PHOTOGRAPHIC EVIDENCE SECTION */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 mt-16 pt-12 border-t border-black/10">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#6F6F6F] mb-1">
            Optical Verification Dossier
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-[#000000] font-normal tracking-tight">
            1 &amp; 2 Photographic Evidence Log
          </h2>
          <p className="text-sm text-[#6F6F6F] mt-1 max-w-2xl">
            Surveillance captures comparing where the vehicle appeared first (Camera 1) and where it
            subsequently reappeared (Camera 2) with vehicle context and optical plate crops.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sighting 1 Photos Card */}
          <div className="bg-[#F9FAFB] border border-black/10 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-semibold">
                  <MapPin className="w-3 h-3" /> Initial Appearance: {currentTrajectory.firstSeen.cameraId}
                </span>
                <div className="text-sm font-semibold text-black mt-2">
                  {currentTrajectory.firstSeen.districtName}
                </div>
                <div className="text-xs text-[#6F6F6F] font-mono">{currentTrajectory.firstSeen.timestamp}</div>
              </div>
            </div>

            {/* 2 Photos for Appearance */}
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-black/5 border border-black/10 relative group">
                <img
                  src={resolvePhotoUrl(currentTrajectory.firstSeen.photoVehicle)}
                  alt={currentTrajectory.firstSeen.photoLabel1}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Car className="w-8 h-8 text-black/15" />
                </div>
                <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md p-1.5 rounded-lg text-[10px] font-mono text-black truncate shadow-sm">
                  {currentTrajectory.firstSeen.photoLabel1}
                </div>
              </div>

              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-black/5 border border-black/10 relative group">
                <img
                  src={resolvePhotoUrl(currentTrajectory.firstSeen.photoPlate)}
                  alt={currentTrajectory.firstSeen.photoLabel2}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-mono font-bold text-black/20">OCR SCAN</span>
                </div>
                <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md p-1.5 rounded-lg text-[10px] font-mono text-black font-semibold truncate shadow-sm">
                  {currentTrajectory.firstSeen.photoLabel2}
                </div>
              </div>
            </div>
          </div>

          {/* Sighting 2 Photos Card */}
          {currentTrajectory.reappearedAt ? (
            <div className="bg-[#F9FAFB] border border-black/10 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-semibold">
                    <Navigation className="w-3 h-3" /> Reappeared: {currentTrajectory.reappearedAt.cameraId}
                  </span>
                  <div className="text-sm font-semibold text-black mt-2">
                    {currentTrajectory.reappearedAt.districtName}
                  </div>
                  <div className="text-xs text-[#6F6F6F] font-mono">
                    {currentTrajectory.reappearedAt.timestamp}
                  </div>
                </div>
              </div>

              {/* 2 Photos for Reappearance */}
              <div className="grid grid-cols-2 gap-4">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-black/5 border border-black/10 relative group">
                  <img
                    src={resolvePhotoUrl(currentTrajectory.reappearedAt.photoVehicle)}
                    alt={currentTrajectory.reappearedAt.photoLabel1}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Car className="w-8 h-8 text-black/15" />
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md p-1.5 rounded-lg text-[10px] font-mono text-black truncate shadow-sm">
                    {currentTrajectory.reappearedAt.photoLabel1}
                  </div>
                </div>

                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-black/5 border border-black/10 relative group">
                  <img
                    src={resolvePhotoUrl(currentTrajectory.reappearedAt.photoPlate)}
                    alt={currentTrajectory.reappearedAt.photoLabel2}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-mono font-bold text-black/20">OCR SCAN</span>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md p-1.5 rounded-lg text-[10px] font-mono text-black font-semibold truncate shadow-sm">
                    {currentTrajectory.reappearedAt.photoLabel2}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#F9FAFB] border border-black/10 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
              <div className="text-sm font-semibold text-black">No Secondary Reappearance Recorded</div>
              <p className="text-xs text-[#6F6F6F] mt-1 max-w-xs">
                This vehicle was only logged at a single district perimeter checkpoint.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
