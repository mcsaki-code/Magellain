"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Bluetooth,
  BluetoothOff,
  Wind,
  Compass,
  Gauge,
  Waves,
  Thermometer,
  Anchor,
  Navigation,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { useInstrumentStore } from "@/lib/store/instrument-store";
import {
  BluetoothNMEAManager,
  getBluetoothManager,
} from "@/lib/instruments/bluetooth-manager";
import type { NMEAData } from "@/lib/instruments/nmea-parser";

// ─── Instrument Display Card ─────────────────────────────────

function InstrumentCard({
  icon,
  label,
  value,
  unit,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  secondary?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-muted/60 px-2 py-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[9px] uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-0.5">
        <span className="text-lg font-bold tabular-nums text-foreground leading-tight">
          {value}
        </span>
        {unit && (
          <span className="text-[10px] font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {secondary && (
        <span className="text-[9px] text-muted-foreground">{secondary}</span>
      )}
    </div>
  );
}

// ─── Wind Rose (compact) ─────────────────────────────────────

function WindIndicator({ angle, speed }: { angle: number; speed: number }) {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      {/* Ring */}
      <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20" />
      {/* Cardinal marks */}
      {["N", "E", "S", "W"].map((dir, i) => (
        <span
          key={dir}
          className="absolute text-[8px] font-bold text-muted-foreground"
          style={{
            top: i === 0 ? "1px" : i === 2 ? "auto" : "50%",
            bottom: i === 2 ? "1px" : "auto",
            left: i === 3 ? "2px" : i === 1 ? "auto" : "50%",
            right: i === 1 ? "2px" : "auto",
            transform:
              i === 0 || i === 2 ? "translateX(-50%)" : "translateY(-50%)",
          }}
        >
          {dir}
        </span>
      ))}
      {/* Arrow */}
      <div
        className="absolute inset-2 flex items-start justify-center"
        style={{ transform: `rotate(${angle}deg)` }}
      >
        <div className="h-5 w-0.5 rounded-full bg-ocean" />
      </div>
      {/* Center speed */}
      <span className="relative z-10 text-xs font-bold text-foreground">
        {speed.toFixed(0)}
      </span>
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────

export function InstrumentPanel() {
  const {
    connectionStatus,
    connectedDevice,
    errorMessage,
    data,
    showInstrumentPanel,
    setConnectionStatus,
    setConnectedDevice,
    setData,
    toggleInstrumentPanel,
  } = useInstrumentStore();

  const managerRef = useRef<BluetoothNMEAManager | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Check BLE support on mount
  useEffect(() => {
    setIsSupported(BluetoothNMEAManager.isSupported());
  }, []);

  // Wire up manager callbacks
  useEffect(() => {
    const manager = getBluetoothManager();
    managerRef.current = manager;

    const unsubData = manager.onData((nmeaData: NMEAData) => {
      setData(nmeaData);
      const device = manager.getDevice();
      if (device) setConnectedDevice(device);
    });

    const unsubStatus = manager.onStatus((status, message) => {
      setConnectionStatus(status, message);
      if (status === "connected") {
        const device = manager.getDevice();
        if (device) setConnectedDevice(device);
      } else if (status === "disconnected") {
        setConnectedDevice(null);
      }
    });

    return () => {
      unsubData();
      unsubStatus();
    };
  }, [setConnectionStatus, setConnectedDevice, setData]);

  const handleConnect = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;

    if (connectionStatus === "connected") {
      manager.disconnect();
    } else {
      await manager.connect();
    }
  }, [connectionStatus]);

  // Don't render if Bluetooth not supported
  if (!isSupported) return null;

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <div className="absolute bottom-4 left-2 z-10 w-56">
      {/* Header bar */}
      <div
        className="flex items-center gap-2 rounded-xl bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm cursor-pointer"
        onClick={toggleInstrumentPanel}
      >
        {isConnected ? (
          <Bluetooth className="h-4 w-4 shrink-0 text-ocean" />
        ) : isConnecting ? (
          <Loader2 className="h-4 w-4 shrink-0 text-ocean animate-spin" />
        ) : (
          <BluetoothOff className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 text-xs font-semibold text-foreground truncate">
          {isConnected
            ? connectedDevice?.name || "Connected"
            : isConnecting
              ? "Connecting..."
              : "Instruments"}
        </span>
        {isConnected && data?.sentenceCount != null && (
          <span className="text-[9px] text-muted-foreground tabular-nums">
            {data.sentenceCount} msgs
          </span>
        )}
        {showInstrumentPanel ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Expanded panel */}
      {showInstrumentPanel && (
        <div className="mt-1 rounded-xl bg-card/95 p-3 shadow-lg backdrop-blur-sm space-y-3">
          {/* Connect / disconnect button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleConnect();
            }}
            disabled={isConnecting}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors ${
              isConnected
                ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                : "bg-ocean text-white hover:bg-ocean-600"
            } disabled:opacity-50`}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Connecting...
              </>
            ) : isConnected ? (
              <>
                <BluetoothOff className="h-3.5 w-3.5" />
                Disconnect
              </>
            ) : (
              <>
                <Bluetooth className="h-3.5 w-3.5" />
                Connect Instruments
              </>
            )}
          </button>

          {/* Error message */}
          {errorMessage && connectionStatus === "error" && (
            <p className="rounded-lg bg-red-500/10 px-2 py-1.5 text-[10px] text-red-500">
              {errorMessage}
            </p>
          )}

          {/* Live instrument data */}
          {isConnected && data && (
            <>
              {/* Wind section */}
              {(data.apparentWindAngle !== null || data.trueWindAngle !== null) && (
                <div className="flex items-center gap-2">
                  {data.apparentWindAngle !== null && data.apparentWindSpeed !== null && (
                    <WindIndicator
                      angle={data.apparentWindAngle}
                      speed={data.apparentWindSpeed}
                    />
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    {data.apparentWindSpeed !== null && (
                      <InstrumentCard
                        icon={<Wind className="h-3 w-3" />}
                        label="AWA / AWS"
                        value={`${data.apparentWindAngle ?? "—"}\u00B0`}
                        unit={`${data.apparentWindSpeed?.toFixed(1) ?? "—"} kts`}
                      />
                    )}
                    {data.trueWindSpeed !== null && (
                      <InstrumentCard
                        icon={<Wind className="h-3 w-3" />}
                        label="TWA / TWS"
                        value={`${data.trueWindAngle ?? "—"}\u00B0`}
                        unit={`${data.trueWindSpeed?.toFixed(1) ?? "—"} kts`}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Speed & heading grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {data.boatSpeedKts !== null && (
                  <InstrumentCard
                    icon={<Gauge className="h-3 w-3" />}
                    label="BSP"
                    value={data.boatSpeedKts.toFixed(1)}
                    unit="kts"
                  />
                )}
                {data.speedOverGround !== null && (
                  <InstrumentCard
                    icon={<Navigation className="h-3 w-3" />}
                    label="SOG"
                    value={data.speedOverGround.toFixed(1)}
                    unit="kts"
                  />
                )}
                {data.headingTrue !== null && (
                  <InstrumentCard
                    icon={<Compass className="h-3 w-3" />}
                    label="HDG"
                    value={`${data.headingTrue}\u00B0`}
                    secondary="true"
                  />
                )}
                {data.courseOverGround !== null && (
                  <InstrumentCard
                    icon={<Compass className="h-3 w-3" />}
                    label="COG"
                    value={`${data.courseOverGround}\u00B0`}
                    secondary="true"
                  />
                )}
                {data.depthMeters !== null && (
                  <InstrumentCard
                    icon={<Anchor className="h-3 w-3" />}
                    label="Depth"
                    value={data.depthMeters.toFixed(1)}
                    unit="m"
                  />
                )}
                {data.waterTempCelsius !== null && (
                  <InstrumentCard
                    icon={<Thermometer className="h-3 w-3" />}
                    label="Water"
                    value={data.waterTempCelsius.toFixed(1)}
                    unit="\u00B0C"
                  />
                )}
              </div>

              {/* Data freshness */}
              {data.lastUpdate > 0 && (
                <DataFreshness lastUpdate={data.lastUpdate} />
              )}
            </>
          )}

          {/* Not connected help text */}
          {!isConnected && !isConnecting && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Connect a Bluetooth NMEA multiplexer to get live wind, speed,
              heading, and depth from your onboard instruments.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Data freshness indicator ────────────────────────────────

function DataFreshness({ lastUpdate }: { lastUpdate: number }) {
  const [age, setAge] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setAge(Math.floor((Date.now() - lastUpdate) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdate]);

  const fresh = age < 3;
  return (
    <div className="flex items-center justify-center gap-1.5">
      <Waves className={`h-2.5 w-2.5 ${fresh ? "text-green-500" : "text-amber-500"}`} />
      <span className={`text-[9px] ${fresh ? "text-green-500" : "text-amber-500"}`}>
        {fresh ? "Live" : `${age}s ago`}
      </span>
    </div>
  );
}
