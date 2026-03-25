"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Flag, Play, Pause, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

type Phase = "WARNING" | "PREP" | "ONE MIN" | "RACING" | "FINISHED" | "IDLE";

interface RaceTimerState {
  targetTime: number | null; // epoch ms of the gun (T-0:00)
  isPlaying: boolean;
  displayMs: number; // For display purposes
}

export function RaceTimer() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [state, setState] = useState<RaceTimerState>({
    targetTime: null,
    isPlaying: false,
    displayMs: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // Compute phase and remaining time
  const computePhaseAndTime = (targetMs: number | null): { phase: Phase; remainingMs: number } => {
    if (targetMs === null) {
      return { phase: "IDLE", remainingMs: 0 };
    }

    const nowMs = Date.now();
    const remainingMs = targetMs - nowMs;

    if (remainingMs > 240_000) {
      return { phase: "WARNING", remainingMs };
    } else if (remainingMs > 60_000) {
      return { phase: "PREP", remainingMs };
    } else if (remainingMs > 0) {
      return { phase: "ONE MIN", remainingMs };
    } else if (remainingMs <= 0 && remainingMs > -3_600_000) {
      // Counting up: up to 1 hour after start
      return { phase: "RACING", remainingMs };
    } else {
      return { phase: "FINISHED", remainingMs };
    }
  };

  const { phase, remainingMs } = computePhaseAndTime(state.targetTime);

  // Play audio signal (Web Audio API)
  const playBeeps = useCallback((frequency: number, count: number, duration: number, gap: number) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      for (let i = 0; i < count; i++) {
        const startTime = now + (duration + gap) * i;
        const endTime = startTime + duration / 1000;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.value = frequency;
        osc.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, endTime);

        osc.start(startTime);
        osc.stop(endTime);
      }
    } catch {
      // Silent failure if Web Audio is blocked
    }
  }, []);

  // Handle phase transitions and audio
  const prevPhaseRef = useRef<Phase>("IDLE");
  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      if (phase === "WARNING" && state.isPlaying) {
        playBeeps(440, 3, 100, 200);
      } else if (phase === "PREP" && state.isPlaying) {
        playBeeps(440, 3, 100, 200);
      } else if (phase === "ONE MIN" && state.isPlaying) {
        playBeeps(880, 6, 80, 120);
      } else if (phase === "RACING" && state.isPlaying) {
        // Gun sound: long tone
        playBeeps(880, 1, 1200, 0);
      }
      prevPhaseRef.current = phase;
    }
  }, [phase, state.isPlaying, playBeeps]);

  // Update timer display
  useEffect(() => {
    if (!state.isPlaying || state.targetTime === null) return;

    const update = () => {
      setState((prev) => ({
        ...prev,
        displayMs: Date.now() - (prev.targetTime ?? Date.now()) + 5 * 60 * 1000,
      }));
    };

    intervalRef.current = setInterval(update, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isPlaying, state.targetTime]);

  // Button handlers
  const handleStart5Min = () => {
    const newTargetTime = Date.now() + 5 * 60 * 1000;
    setState({
      targetTime: newTargetTime,
      isPlaying: true,
      displayMs: 0,
    });
    prevPhaseRef.current = "IDLE";
  };

  const handleSync = () => {
    // Gun just fired, set target to now (so we're at T-0:00)
    setState({
      targetTime: Date.now(),
      isPlaying: true,
      displayMs: 0,
    });
    prevPhaseRef.current = "IDLE";
    // Trigger the start beep
    playBeeps(880, 1, 1200, 0);
  };

  const handlePlayPause = () => {
    setState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  };

  const handleReset = () => {
    setState({
      targetTime: null,
      isPlaying: false,
      displayMs: 0,
    });
    prevPhaseRef.current = "IDLE";
    setIsExpanded(false);
  };

  // Format time display
  const formatTime = (ms: number): string => {
    const sign = ms < 0 ? "-" : "";
    const absMs = Math.abs(ms);
    const totalSeconds = Math.floor(absMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${sign}${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  // Compute progress percentage for current phase
  const computeProgressPercent = (): number => {
    if (phase === "IDLE" || phase === "FINISHED") return 0;

    let phaseStartMs = 0;
    let phaseEndMs = 0;

    if (phase === "WARNING") {
      phaseStartMs = 300_000;
      phaseEndMs = 240_000;
    } else if (phase === "PREP") {
      phaseStartMs = 240_000;
      phaseEndMs = 60_000;
    } else if (phase === "ONE MIN") {
      phaseStartMs = 60_000;
      phaseEndMs = 0;
    } else if (phase === "RACING") {
      // For racing, show elapsed time (0-100% over first 5 minutes)
      const elapsedMs = Math.abs(remainingMs);
      return Math.min((elapsedMs / (5 * 60_000)) * 100, 100);
    }

    if (remainingMs <= phaseEndMs) return 100;
    if (remainingMs >= phaseStartMs) return 0;

    const phaseProgress = (phaseStartMs - remainingMs) / (phaseStartMs - phaseEndMs);
    return Math.max(0, Math.min(100, phaseProgress * 100));
  };

  const progressPercent = computeProgressPercent();

  // Determine phase color
  const getPhaseColor = (): string => {
    switch (phase) {
      case "WARNING":
        return "text-yellow-400";
      case "PREP":
        return "text-orange-400";
      case "ONE MIN":
        return phase === "ONE MIN" && remainingMs < 60_000 && remainingMs > 0
          ? "text-red-500 animate-pulse"
          : "text-red-500";
      case "RACING":
        return "text-green-400";
      default:
        return "text-muted-foreground";
    }
  };

  // Idle state (collapsed)
  if (!state.isPlaying && state.targetTime === null) {
    return (
      <div className="absolute bottom-48 right-2 z-20 w-52">
        <div
          className="flex items-center gap-2 rounded-xl bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm cursor-pointer"
          onClick={() => setIsExpanded((e) => !e)}
        >
          <Flag className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-xs font-semibold text-foreground">Start Timer</span>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Expanded idle panel */}
        {isExpanded && (
          <div className="mt-1 rounded-xl bg-card/95 p-3 shadow-lg backdrop-blur-sm space-y-3">
            <p className="text-center text-xs font-semibold text-muted-foreground">5-Minute Sequence</p>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStart5Min();
                }}
                className="flex-1 rounded-lg bg-ocean px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-ocean-600"
              >
                5 MIN
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSync();
                }}
                className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700"
              >
                SYNC
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80"
              >
                RESET
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Counting down / racing state
  return (
    <div className="absolute bottom-48 right-2 z-20 w-64">
      <div className="rounded-xl bg-card/95 p-4 shadow-lg backdrop-blur-sm space-y-3">
        {/* Phase label */}
        <div className="text-center">
          <p className={`text-sm font-bold ${getPhaseColor()}`}>{phase}</p>
        </div>

        {/* Large time display */}
        <div className="text-center">
          <p className="font-mono text-4xl font-bold text-foreground">
            {phase === "RACING" ? "+" : ""}
            {formatTime(remainingMs)}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-ocean transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePlayPause();
            }}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-ocean hover:bg-ocean-600 text-white transition-colors"
            title={state.isPlaying ? "Pause" : "Play"}
          >
            {state.isPlaying ? (
              <Pause className="h-4 w-4 fill-white" />
            ) : (
              <Play className="h-4 w-4 fill-white" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
