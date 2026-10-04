"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Layers,
  AlertCircle,
} from 'lucide-react';
import type { TimelineMarker, Vehicle } from '../types/anpr';

interface VideoTimelinePlayerProps {
  videoName: string;
  matchedVehicle: Vehicle | null;
  allVehicles?: Vehicle[];
  videoDuration: number;
  onSelectTimestamp?: (timestamp: number) => void;
  selectedTimestamp?: number | null;
  customVideoUrl?: string | null;
}

import { BACKEND_URL } from "@/lib/config";

export const VideoTimelinePlayer: React.FC<VideoTimelinePlayerProps> = ({
  videoName,
  matchedVehicle,
  allVehicles = [],
  videoDuration,
  onSelectTimestamp,
  selectedTimestamp,
  customVideoUrl,
}) => {
  const screenContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(videoDuration || 0);
  const [showCanvasOverlay, setShowCanvasOverlay] = useState<boolean>(true);
  const [hoveredMarker, setHoveredMarker] = useState<TimelineMarker | null>(null);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControlsInFullscreen, setShowControlsInFullscreen] = useState<boolean>(true);

  // Prefer inbuilt preprocessed video for zero-latency direct CDN streaming
  const localVideoUrl = customVideoUrl || `/videos/${videoName}`;
  const remoteVideoUrl = customVideoUrl ? null : (BACKEND_URL ? `${BACKEND_URL}/api/video/stream/${videoName}` : null);
  const [videoUrl, setVideoUrl] = useState<string>(localVideoUrl);

  useEffect(() => {
    if (customVideoUrl) {
      setVideoUrl(customVideoUrl);
    } else {
      setVideoUrl(`/videos/${videoName}`);
    }
    setHasError(false);
  }, [videoName, customVideoUrl]);

  const markers: TimelineMarker[] = matchedVehicle?.timeline_markers || [];
  const pendingSeekRef = useRef<number | null>(null);

  // Draw bounding box & OCR plate tags on overlay canvas with exact letterbox/pillarbox compensation
  const drawBoundingBoxOverlay = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const container = screenContainerRef.current;
    if (!canvas || !video || !showCanvasOverlay) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use container dimensions or client dimensions
    const cWidth = container ? container.clientWidth : (video.clientWidth || 960);
    const cHeight = container ? container.clientHeight : (video.clientHeight || 540);

    if (canvas.width !== cWidth || canvas.height !== cHeight) {
      canvas.width = cWidth;
      canvas.height = cHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    // Don't render until video dimensions are known to prevent misaligned boxes
    if (!vWidth || !vHeight || !cWidth || !cHeight) return;

    // Calculate letterbox & pillarbox offsets
    const videoRatio = vWidth / vHeight;
    const containerRatio = cWidth / cHeight;
    let renderW = cWidth;
    let renderH = cHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (containerRatio > videoRatio) {
      // Pillarbox (black bars on left and right)
      renderH = cHeight;
      renderW = renderH * videoRatio;
      offsetX = (cWidth - renderW) / 2;
    } else {
      // Letterbox (black bars on top and bottom)
      renderW = cWidth;
      renderH = renderW / videoRatio;
      offsetY = (cHeight - renderH) / 2;
    }

    const scaleX = renderW / vWidth;
    const scaleY = renderH / vHeight;

    // Determine list of vehicles to render
    const vehiclesToRender: Vehicle[] = [];
    if (matchedVehicle) {
      vehiclesToRender.push(matchedVehicle);
    }
    // Also include any other vehicles in this frame from allVehicles
    if (allVehicles && allVehicles.length > 0) {
      for (const v of allVehicles) {
        if (!matchedVehicle || v.plate !== matchedVehicle.plate) {
          vehiclesToRender.push(v);
        }
      }
    }

    for (const veh of vehiclesToRender) {
      const isTarget = matchedVehicle && veh.plate === matchedVehicle.plate;
      const vehMarkers = veh.timeline_markers || [];

      let activeBox: number[] | null = null;
      const firstSeen = veh.first_seen ?? (vehMarkers[0]?.timestamp ?? 0);
      const lastSeen = veh.last_seen ?? (vehMarkers[vehMarkers.length - 1]?.timestamp ?? 10);

      // Strict presence window: vehicle must be present on camera within [firstSeen - 0.15, lastSeen + 0.15]
      const isWithinPresence = time >= (firstSeen - 0.15) && time <= (lastSeen + 0.15);

      if (vehMarkers.length > 0 && isWithinPresence) {
        // Find closest markers and interpolate if between them
        let closest = vehMarkers[0];
        let minDiff = Math.abs(vehMarkers[0].timestamp - time);
        let beforeMarker: TimelineMarker | null = null;
        let afterMarker: TimelineMarker | null = null;

        for (const m of vehMarkers) {
          const diff = Math.abs(m.timestamp - time);
          if (diff < minDiff) {
            minDiff = diff;
            closest = m;
          }
          if (m.timestamp <= time) {
            if (!beforeMarker || m.timestamp > beforeMarker.timestamp) {
              beforeMarker = m;
            }
          }
          if (m.timestamp >= time) {
            if (!afterMarker || m.timestamp < afterMarker.timestamp) {
              afterMarker = m;
            }
          }
        }

        if (beforeMarker && afterMarker && beforeMarker !== afterMarker && beforeMarker.box && afterMarker.box) {
          const tSpan = afterMarker.timestamp - beforeMarker.timestamp;
          // Smoothly interpolate between markers up to 3.0s apart
          if (tSpan > 0 && tSpan <= 3.0) {
            const factor = Math.max(0, Math.min(1, (time - beforeMarker.timestamp) / tSpan));
            const b1 = beforeMarker.box;
            const b2 = afterMarker.box;
            activeBox = [
              b1[0] + (b2[0] - b1[0]) * factor,
              b1[1] + (b2[1] - b1[1]) * factor,
              b1[2] + (b2[2] - b1[2]) * factor,
              b1[3] + (b2[3] - b1[3]) * factor,
            ];
          } else if (minDiff <= 1.2 && closest?.box) {
            activeBox = closest.box;
          }
        } else if (minDiff <= 1.2 && closest?.box) {
          activeBox = closest.box;
        }
      } else if (veh.best_box && isWithinPresence && vehMarkers.length === 0) {
        activeBox = veh.best_box;
      }

      if (!activeBox) continue;

      const [x1, y1, x2, y2] = activeBox;
      const rx = offsetX + (x1 * scaleX);
      const ry = offsetY + (y1 * scaleY);
      const rw = Math.max(12, (x2 - x1) * scaleX);
      const rh = Math.max(12, (y2 - y1) * scaleY);

      // Color scheme: Emerald for selected target vehicle, Cyan for other spotted vehicles
      const strokeColor = isTarget ? '#00FF66' : '#38BDF8';
      const shadowColor = isTarget ? '#00FF66' : '#0284C7';
      const glowBlur = isTarget ? 14 : 6;
      const lineWidth = Math.max(2, Math.round(3 * (renderH / 720)));

      // Glowing bounding box
      ctx.save();
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = glowBlur;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();

      // Corner accent brackets for target vehicle
      if (isTarget) {
        const cornerLen = Math.min(rw / 3.5, rh / 3.5, 14);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = lineWidth + 1;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(rx, ry + cornerLen);
        ctx.lineTo(rx, ry);
        ctx.lineTo(rx + cornerLen, ry);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(rx + rw - cornerLen, ry);
        ctx.lineTo(rx + rw, ry);
        ctx.lineTo(rx + rw, ry + cornerLen);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(rx, ry + rh - cornerLen);
        ctx.lineTo(rx, ry + rh);
        ctx.lineTo(rx + cornerLen, ry + rh);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(rx + rw - cornerLen, ry + rh);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.lineTo(rx + rw, ry + rh - cornerLen);
        ctx.stroke();
      }

      // Plate Label Badge
      const confPercent = Math.round((veh.best_ocr_confidence || 0.95) * 100);
      const label = `${veh.plate} • ${confPercent}%`;
      const fontSize = Math.max(11, Math.min(20, Math.round(13 * (renderH / 600))));
      ctx.font = `bold ${fontSize}px Inter, ui-sans-serif, sans-serif`;
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const badgeH = fontSize + 10;
      const badgeW = textWidth + 16;

      // Position badge above bounding box (or below if too close to top edge)
      const labelY = ry >= badgeH + 6 ? ry - 6 : ry + rh + badgeH + 6;
      const badgeTop = labelY - badgeH;

      // Badge background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(rx, badgeTop, badgeW, badgeH, 4);
        ctx.fill();
      } else {
        ctx.fillRect(rx, badgeTop, badgeW, badgeH);
      }

      // Left indicator pill
      ctx.fillStyle = strokeColor;
      ctx.fillRect(rx, badgeTop, 3.5, badgeH);

      // Label text
      ctx.fillStyle = strokeColor;
      ctx.fillText(label, rx + 8, badgeTop + fontSize + 2);
    }
  }, [matchedVehicle, allVehicles, showCanvasOverlay]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curr = videoRef.current.currentTime;
      setCurrentTime(curr);
      drawBoundingBoxOverlay(curr);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (!isNaN(dur) && dur > 0) {
        setDuration(dur);
      }
      setIsBuffering(false);
      setHasError(false);

      const target = pendingSeekRef.current ?? selectedTimestamp;
      if (target !== null && target !== undefined) {
        videoRef.current.currentTime = target;
        setCurrentTime(target);
        pendingSeekRef.current = null;
      }
      drawBoundingBoxOverlay(videoRef.current.currentTime || 0);
    }
  };

  const handleCanPlay = () => {
    setIsBuffering(false);
    setHasError(false);
    if (pendingSeekRef.current !== null && videoRef.current) {
      videoRef.current.currentTime = pendingSeekRef.current;
      setCurrentTime(pendingSeekRef.current);
      drawBoundingBoxOverlay(pendingSeekRef.current);
      pendingSeekRef.current = null;
    }
  };

  // 60 FPS Smooth Canvas Animation Loop during playback
  useEffect(() => {
    let animId: number;
    const updateLoop = () => {
      if (videoRef.current && !videoRef.current.paused) {
        const curr = videoRef.current.currentTime;
        setCurrentTime(curr);
        drawBoundingBoxOverlay(curr);
        animId = requestAnimationFrame(updateLoop);
      }
    };

    if (isPlaying) {
      animId = requestAnimationFrame(updateLoop);
    } else if (videoRef.current) {
      drawBoundingBoxOverlay(videoRef.current.currentTime);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, drawBoundingBoxOverlay]);

  // Reload video element whenever videoName or customVideoUrl changes
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      setIsPlaying(false);
      setCurrentTime(0);
      setHasError(false);
      setIsBuffering(true);
      video.pause();
      video.load();
    }
  }, [videoName, customVideoUrl]);

  // Handle external selectedTimestamp seek
  useEffect(() => {
    if (
      selectedTimestamp !== null &&
      selectedTimestamp !== undefined &&
      videoRef.current
    ) {
      const video = videoRef.current;
      pendingSeekRef.current = selectedTimestamp;
      if (video.readyState >= 1) {
        video.currentTime = selectedTimestamp;
        setCurrentTime(selectedTimestamp);
        drawBoundingBoxOverlay(selectedTimestamp);
        pendingSeekRef.current = null;
      }
    }
  }, [selectedTimestamp, drawBoundingBoxOverlay]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      // Re-render canvas with new screen dimensions
      requestAnimationFrame(() => {
        if (videoRef.current) {
          drawBoundingBoxOverlay(videoRef.current.currentTime);
        }
      });
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [drawBoundingBoxOverlay]);

  // Observe container resizing (including entering/exiting fullscreen or window resize)
  useEffect(() => {
    const container = screenContainerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      if (videoRef.current) {
        drawBoundingBoxOverlay(videoRef.current.currentTime);
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [drawBoundingBoxOverlay]);

  // Auto-hide controls in fullscreen after inactivity
  useEffect(() => {
    let hideTimer: any = null;
    const handleMouseMove = () => {
      setShowControlsInFullscreen(true);
      clearTimeout(hideTimer);
      if (isPlaying) {
        hideTimer = setTimeout(() => {
          setShowControlsInFullscreen(false);
        }, 2800);
      }
    };

    const container = screenContainerRef.current;
    if (container && isFullscreen) {
      container.addEventListener('mousemove', handleMouseMove);
    }
    return () => {
      if (container) container.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(hideTimer);
    };
  }, [isFullscreen, isPlaying]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Play error:', err);
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    const clampedTime = Math.max(0, Math.min(duration || videoDuration, time));
    video.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    drawBoundingBoxOverlay(clampedTime);
    if (onSelectTimestamp) onSelectTimestamp(clampedTime);
  };

  // Jump to previous/next detection
  const jumpPrev = () => {
    if (!markers.length) return;
    const prev = [...markers]
      .reverse()
      .find((m) => m.timestamp < currentTime - 0.2);
    if (prev) seekTo(prev.timestamp);
    else seekTo(markers[0].timestamp);
  };

  const jumpNext = () => {
    if (!markers.length) return;
    const next = markers.find((m) => m.timestamp > currentTime + 0.2);
    if (next) seekTo(next.timestamp);
    else seekTo(markers[markers.length - 1].timestamp);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  // Toggle fullscreen mode on the video screen container (so canvas overlay stays attached!)
  const toggleFullscreen = () => {
    const container = screenContainerRef.current as any;
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch((err: any) => console.error('Fullscreen error:', err));
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err: any) => console.error('Exit fullscreen error:', err));
      }
    }
  };

  const formatSecs = (sec: number) => {
    if (isNaN(sec)) return '00:00.0';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec - Math.floor(sec)) * 10);
    return `${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="w-full bg-[#111113] border border-white/10 rounded-3xl overflow-hidden shadow-2xl text-white">
      {/* Video Header Bar (Normal mode) */}
      {!isFullscreen && (
        <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider text-white/90">
              Feed: {videoName}
            </span>
            {matchedVehicle && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-white/10 text-white px-2.5 py-0.5 rounded-full font-mono">
                  Target: <strong className="text-emerald-400">{matchedVehicle.plate}</strong>
                </span>
                {matchedVehicle.first_seen !== undefined && Math.abs(currentTime - matchedVehicle.first_seen) > 0.8 && (
                  <button
                    type="button"
                    onClick={() => seekTo(matchedVehicle.first_seen)}
                    className="text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono transition-all flex items-center gap-1 cursor-pointer"
                    title={`Jump to plate ${matchedVehicle.plate} detection`}
                  >
                    <span>⚡ Jump to Plate ({formatSecs(matchedVehicle.first_seen)})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Vision AI Tracking Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCanvasOverlay(!showCanvasOverlay)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                showCanvasOverlay
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'bg-white/5 text-white/50 hover:text-white border border-white/10'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showCanvasOverlay ? 'AI Bounding Box Active' : 'Bounding Box Hidden'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Video Screen Container (The actual element placed into Fullscreen) */}
      <div
        ref={screenContainerRef}
        onDoubleClick={toggleFullscreen}
        className={`relative w-full bg-black flex items-center justify-center overflow-hidden group select-none ${
          isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'aspect-video'
        }`}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted={isMuted}
          preload="auto"
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onSeeked={() => {
            if (videoRef.current) {
              drawBoundingBoxOverlay(videoRef.current.currentTime);
            }
          }}
          onLoadedData={() => {
            setIsBuffering(false);
            setHasError(false);
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
            setHasError(false);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            if (videoRef.current) {
              drawBoundingBoxOverlay(videoRef.current.currentTime);
            }
          }}
          onError={(e) => {
            if (videoUrl !== remoteVideoUrl && remoteVideoUrl) {
              console.log('Inbuilt video feed missed, trying remote stream:', remoteVideoUrl);
              setVideoUrl(remoteVideoUrl);
            } else {
              console.error('Video error:', e);
              setHasError(true);
              setIsBuffering(false);
            }
          }}
          className="w-full h-full object-contain cursor-pointer"
          onClick={togglePlay}
        />

        {/* Dynamic Canvas Bounding Box Overlay (Sits directly on top of video at all times) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none w-full h-full z-10"
        />

        {/* Buffering Indicator */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-30">
            <div className="w-10 h-10 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error Fallback Indicator */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center z-40">
            <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
            <p className="text-sm font-medium text-white mb-3">
              Unable to stream video feed directly.
            </p>
            <button
              type="button"
              onClick={() => {
                setHasError(false);
                if (videoRef.current) {
                  videoRef.current.load();
                }
              }}
              className="px-4 py-2 bg-white text-black text-xs font-semibold rounded-full hover:bg-white/90 transition-all cursor-pointer"
            >
              Retry Loading
            </button>
          </div>
        )}

        {/* Center Play Button Overlay (shown when paused) */}
        {!isPlaying && !isBuffering && !hasError && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute p-5 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white hover:scale-110 active:scale-95 transition-transform cursor-pointer shadow-2xl z-20"
          >
            <Play className="w-8 h-8 fill-white ml-0.5" />
          </button>
        )}

        {/* Fullscreen Floating HUD Overlay (Header & Bottom Bar) */}
        {isFullscreen && (
          <div
            className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-30 transition-opacity duration-300 ${
              showControlsInFullscreen || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Top HUD Bar */}
            <div className="flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/80 via-black/40 to-transparent -mx-6 -mt-6 p-6">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-sm uppercase tracking-wider text-white/90">
                  {videoName}
                </span>
                {matchedVehicle && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full font-mono font-bold">
                    Target: {matchedVehicle.plate} ({matchedVehicle.state})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCanvasOverlay(!showCanvasOverlay)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    showCanvasOverlay
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/10 text-white/60 hover:text-white border border-white/10'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{showCanvasOverlay ? 'AI Bounding Box ON' : 'AI Bounding Box OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Exit Fullscreen"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom HUD Bar in Fullscreen */}
            <div className="pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent -mx-6 -mb-6 p-6 space-y-4">
              {/* Fullscreen Scrubber */}
              <div className="relative group select-none">
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = (e.clientX - rect.left) / rect.width;
                    seekTo(pos * (duration || videoDuration));
                  }}
                  className="relative h-4 w-full bg-white/20 rounded-full cursor-pointer flex items-center overflow-visible hover:h-5 transition-all"
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-full pointer-events-none"
                    style={{
                      width: `${Math.min(
                        100,
                        (currentTime / Math.max(duration || videoDuration, 0.1)) * 100
                      )}%`,
                    }}
                  />

                  {markers.map((marker, idx) => {
                    const isNearCurrent = Math.abs(marker.timestamp - currentTime) < 0.25;
                    return (
                      <div
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          seekTo(marker.timestamp);
                        }}
                        onMouseEnter={() => setHoveredMarker(marker)}
                        onMouseLeave={() => setHoveredMarker(null)}
                        className={`absolute -translate-x-1/2 w-3 h-7 rounded-sm cursor-pointer transition-transform ${
                          isNearCurrent
                            ? 'bg-emerald-400 scale-125 z-20 shadow-[0_0_14px_#00FF66]'
                            : 'bg-emerald-500/80 hover:bg-emerald-300 hover:scale-110 z-10'
                        }`}
                        style={{ left: `${marker.percentage}%` }}
                      />
                    );
                  })}

                  <div
                    className="absolute -translate-x-1/2 w-4 h-8 rounded-md bg-white shadow-md z-30 pointer-events-none flex items-center justify-center border border-black/30"
                    style={{
                      left: `${Math.min(
                        100,
                        (currentTime / Math.max(duration || videoDuration, 0.1)) * 100
                      )}%`,
                    }}
                  >
                    <div className="w-1 h-3.5 bg-black/50 rounded-full" />
                  </div>
                </div>

                {hoveredMarker && (
                  <div
                    className="absolute -top-10 -translate-x-1/2 px-2.5 py-1 bg-black/90 border border-white/20 text-[11px] font-mono rounded-md pointer-events-none z-40 whitespace-nowrap shadow-xl"
                    style={{ left: `${hoveredMarker.percentage}%` }}
                  >
                    Spotted: <strong className="text-emerald-400">{hoveredMarker.formatted_time}</strong> (Frame #{hoveredMarker.frame})
                  </div>
                )}
              </div>

              {/* Fullscreen Bottom Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="p-3 rounded-full bg-white text-black hover:bg-white/90 transition-all active:scale-95 cursor-pointer shadow-md"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => seekTo(0)}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title="Restart"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  </button>

                  <div className="h-4 w-px bg-white/15 mx-1" />

                  <button
                    type="button"
                    onClick={jumpPrev}
                    disabled={!markers.length}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white transition-colors disabled:opacity-30 cursor-pointer"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <button
                    type="button"
                    onClick={jumpNext}
                    disabled={!markers.length}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white transition-colors disabled:opacity-30 cursor-pointer"
                  >
                    <span>Next</span>
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-mono text-xs text-white/80 ml-2">
                    <strong className="text-emerald-400">{formatSecs(currentTime)}</strong> / {formatSecs(duration || videoDuration)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title="Exit Fullscreen"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Timeline & Markers Area (Normal non-fullscreen mode) */}
      {!isFullscreen && (
        <div className="p-6 bg-[#161619] border-t border-white/5 space-y-4">
          {/* Timeline Header Info */}
          <div className="flex justify-between items-center text-xs text-white/60">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white/90">Timeline Navigator:</span>
              {markers.length > 0 ? (
                <span className="text-emerald-400 font-mono">
                  {markers.length} appearances spotted in {videoName}
                </span>
              ) : (
                <span>No vehicle selected</span>
              )}
            </div>
            <div className="font-mono text-xs">
              <span className="text-emerald-400 font-bold">{formatSecs(currentTime)}</span>
              <span className="text-white/40"> / </span>
              <span>{formatSecs(duration || videoDuration)}</span>
            </div>
          </div>

          {/* Interactive Custom Timeline Bar */}
          <div className="relative group select-none">
            {/* Base Scrubber Track */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                seekTo(pos * (duration || videoDuration));
              }}
              className="relative h-4 w-full bg-white/10 rounded-full cursor-pointer flex items-center overflow-visible hover:h-5 transition-all"
            >
              {/* Progress Fill */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none"
                style={{
                  width: `${Math.min(
                    100,
                    (currentTime / Math.max(duration || videoDuration, 0.1)) * 100
                  )}%`,
                }}
              />

              {/* Spotted Vehicle Timeline Markers */}
              {markers.map((marker, idx) => {
                const isNearCurrent = Math.abs(marker.timestamp - currentTime) < 0.25;
                return (
                  <div
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(marker.timestamp);
                    }}
                    onMouseEnter={() => setHoveredMarker(marker)}
                    onMouseLeave={() => setHoveredMarker(null)}
                    className={`absolute -translate-x-1/2 w-2.5 h-6 rounded-sm cursor-pointer transition-transform ${
                      isNearCurrent
                        ? 'bg-emerald-400 scale-125 z-20 shadow-[0_0_12px_#00FF66]'
                        : 'bg-emerald-500/80 hover:bg-emerald-300 hover:scale-110 z-10'
                    }`}
                    style={{ left: `${marker.percentage}%` }}
                  />
                );
              })}

              {/* Playhead Scrubber Thumb */}
              <div
                className="absolute -translate-x-1/2 w-4 h-7 rounded-md bg-white shadow-md z-30 pointer-events-none flex items-center justify-center border border-black/30"
                style={{
                  left: `${Math.min(
                    100,
                    (currentTime / Math.max(duration || videoDuration, 0.1)) * 100
                  )}%`,
                }}
              >
                <div className="w-1 h-3 bg-black/50 rounded-full" />
              </div>
            </div>

            {/* Hovered Marker Tooltip */}
            {hoveredMarker && (
              <div
                className="absolute -top-10 -translate-x-1/2 px-2.5 py-1 bg-black/90 border border-white/20 text-[11px] font-mono rounded-md pointer-events-none z-40 whitespace-nowrap shadow-xl"
                style={{ left: `${hoveredMarker.percentage}%` }}
              >
                Spotted: <strong className="text-emerald-400">{hoveredMarker.formatted_time}</strong> (Frame #{hoveredMarker.frame})
              </div>
            )}
          </div>

          {/* Video Control Buttons */}
          <div className="flex flex-wrap items-center justify-between pt-2 gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-2.5 rounded-full bg-white text-black hover:bg-white/90 transition-all active:scale-95 cursor-pointer shadow-md"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => seekTo(0)}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-white transition-colors cursor-pointer"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <div className="h-4 w-px bg-white/10 mx-1" />

              <button
                type="button"
                onClick={jumpPrev}
                disabled={!markers.length}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 text-xs text-white/80 transition-colors disabled:opacity-30 cursor-pointer"
                title="Jump to Previous Sighting"
              >
                <SkipBack className="w-3.5 h-3.5" />
                <span>Prev Sighting</span>
              </button>

              <button
                type="button"
                onClick={jumpNext}
                disabled={!markers.length}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 text-xs text-white/80 transition-colors disabled:opacity-30 cursor-pointer"
                title="Jump to Next Sighting"
              >
                <span>Next Sighting</span>
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Fullscreen Button */}
            <div>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/15 text-white/80 transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
