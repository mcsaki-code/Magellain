"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Route, Play, Pause, Square, ChevronDown, ChevronUp } from "lucide-react";
import { useMapStore } from "@/lib/store/map-store";
import { createClient } from "@/lib/supabase/client";
import type { TrackPoint } from "@/lib/store/map-store";

interface SavedTrack {
  id: string;
  started_at: string;
  distance_nm: number;
  duration_s: number;
  max_speed_kts: number;
  track_points: TrackPoint[];
}

interface LocalTrack {
  points: TrackPoint[];
  stats: {
    durationSec: number;
    distanceNm: number;
    maxSpeed: number;
    avgSpeed: number;
  };
  savedAt: string;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDistance(nm: number): string {
  return `${nm.toFixed(1)} nm`;
}

function formatSpeed(kts: number): string {
  return `${kts.toFixed(1)} kts`;
}

export function TrackReplay() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tracks, setTracks] = useState<SavedTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  const {
    activeTrackPoints,
    activeTrackId,
    activeTrackMeta,
    playbackIndex,
    isReplaying,
    setActiveTrack,
    clearActiveTrack,
    setPlaybackIndex,
    setIsReplaying,
  } = useMapStore();

  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch saved tracks from Supabase or localStorage
  useEffect(() => {
    const fetchTracks = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Fetch from Supabase
          const { data } = await supabase
            .from("gps_tracks")
            .select("id, started_at, distance_nm, duration_s, max_speed_kts, track_points")
            .eq("user_id", user.id)
            .order("started_at", { ascending: false });

          if (data) {
            setTracks(data as SavedTrack[]);
            return;
          }
        }

        // Fallback to localStorage
        const localTracks = JSON.parse(
          localStorage.getItem("magellain-gps-tracks") || "[]"
        ) as LocalTrack[];

        const convertedTracks: SavedTrack[] = localTracks.map((lt, idx) => ({
          id: `local-${idx}`,
          started_at: new Date(lt.points[0]?.timestamp || Date.now()).toISOString(),
          distance_nm: lt.stats.distanceNm,
          duration_s: lt.stats.durationSec,
          max_speed_kts: lt.stats.maxSpeed,
          track_points: lt.points,
        }));

        setTracks(convertedTracks);
      } catch (err) {
        console.error("Error fetching tracks:", err);
        // Fallback to localStorage on error
        const localTracks = JSON.parse(
          localStorage.getItem("magellain-gps-tracks") || "[]"
        ) as LocalTrack[];

        const convertedTracks: SavedTrack[] = localTracks.map((lt, idx) => ({
          id: `local-${idx}`,
          started_at: new Date(lt.points[0]?.timestamp || Date.now()).toISOString(),
          distance_nm: lt.stats.distanceNm,
          duration_s: lt.stats.durationSec,
          max_speed_kts: lt.stats.maxSpeed,
          track_points: lt.points,
        }));

        setTracks(convertedTracks);
      } finally {
        setLoading(false);
      }
    };

    if (isExpanded && tracks.length === 0 && activeTrackPoints === null) {
      fetchTracks();
    }
  }, [isExpanded, tracks.length, activeTrackPoints]);

  // Handle playback interval
  useEffect(() => {
    if (!activeTrackPoints || !isReplaying) {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      return;
    }

    const interval = 100 / speedMultiplier; // ms per frame

    playbackIntervalRef.current = setInterval(() => {
      setPlaybackIndex((currentIndex) => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= activeTrackPoints.length) {
          // Stop at end
          setIsReplaying(false);
          return currentIndex;
        }
        return nextIndex;
      });
    }, interval);

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    };
  }, [activeTrackPoints, isReplaying, speedMultiplier, setPlaybackIndex, setIsReplaying]);

  const handleSelectTrack = useCallback(
    (track: SavedTrack) => {
      setActiveTrack(track.id, track.track_points, {
        date: formatDate(track.started_at),
        distance_nm: track.distance_nm,
        duration_s: track.duration_s,
        max_speed_kts: track.max_speed_kts,
      });
      setIsExpanded(false);
      setSpeedMultiplier(1);
    },
    [setActiveTrack]
  );

  const handlePlayPause = useCallback(() => {
    setIsReplaying(!isReplaying);
  }, [isReplaying, setIsReplaying]);

  const handleStop = useCallback(() => {
    clearActiveTrack();
    setSpeedMultiplier(1);
  }, [clearActiveTrack]);

  const currentPoint =
    activeTrackPoints && playbackIndex >= 0 && playbackIndex < activeTrackPoints.length
      ? activeTrackPoints[playbackIndex]
      : null;

  const progressPercent =
    activeTrackPoints && activeTrackPoints.length > 1
      ? (playbackIndex / (activeTrackPoints.length - 1)) * 100
      : 0;

  const elapsedSeconds =
    currentPoint && activeTrackPoints?.[0]
      ? Math.floor((currentPoint.timestamp - activeTrackPoints[0].timestamp) / 1000)
      : 0;

  if (activeTrackPoints === null) {
    // STATE A: Track List
    return (
      <div className="absolute bottom-48 left-3 z-20 w-60">
        <div
          className="flex items-center gap-2 rounded-xl bg-card/90 px-3 py-2 shadow-lg backdrop-blur-sm cursor-pointer border border-border/50"
          onClick={() => setIsExpanded((e) => !e)}
        >
          <Route className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-xs font-semibold text-foreground">Routes</span>
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        {isExpanded && (
          <div className="mt-2 rounded-xl bg-card/90 backdrop-blur-sm border border-border/50 shadow-lg overflow-hidden">
            {loading ? (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                Loading tracks...
              </div>
            ) : tracks.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                No saved tracks
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {tracks.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => handleSelectTrack(track)}
                    className="w-full text-left px-3 py-2 border-b border-border/30 last:border-b-0 hover:bg-muted/50 transition-colors flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        {formatDate(track.started_at)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDuration(track.duration_s)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistance(track.distance_nm)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatSpeed(track.max_speed_kts)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // STATE B: Playback Controls
  return (
    <div className="absolute bottom-48 left-3 z-20 w-72">
      <div className="rounded-xl bg-card/90 backdrop-blur-sm border border-border/50 shadow-lg p-3 space-y-3">
        {/* Track Meta Stats */}
        {activeTrackMeta && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{activeTrackMeta.distance_nm.toFixed(1)} nm</span>
            <span>{formatDuration(activeTrackMeta.duration_s)}</span>
            <span>{activeTrackMeta.max_speed_kts.toFixed(1)} kts</span>
          </div>
        )}

        {/* Progress Slider */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max={activeTrackPoints.length - 1}
            value={playbackIndex}
            onChange={(e) => {
              setPlaybackIndex(parseInt(e.target.value, 10));
              setIsReplaying(false);
            }}
            className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-orange-500"
          />
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>{formatDuration(elapsedSeconds)}</span>
            <span>
              {playbackIndex + 1} / {activeTrackPoints.length}
            </span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-ocean hover:bg-ocean-600 text-white transition-colors"
            title={isReplaying ? "Pause" : "Play"}
          >
            {isReplaying ? (
              <Pause className="h-4 w-4 fill-white" />
            ) : (
              <Play className="h-4 w-4 fill-white" />
            )}
          </button>

          <button
            onClick={handleStop}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </button>

          {/* Speed Selector */}
          <div className="flex-1 flex items-center gap-1">
            {[1, 5, 20, 50].map((speed) => (
              <button
                key={speed}
                onClick={() => {
                  setSpeedMultiplier(speed);
                  if (isReplaying) {
                    setIsReplaying(false);
                    setIsReplaying(true);
                  }
                }}
                className={`flex-1 px-2 py-1 rounded text-[9px] font-semibold transition-colors ${
                  speedMultiplier === speed
                    ? "bg-orange-500 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Current Point Stats */}
        {currentPoint && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Speed: {currentPoint.speed_kts?.toFixed(1) ?? "--"} kts</span>
            <span>Time: {formatDuration(elapsedSeconds)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
