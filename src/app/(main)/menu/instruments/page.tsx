"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bluetooth,
  BluetoothOff,
  Info,
  Radio,
  Loader2,
  Unplug,
  Gauge,
  Wind,
  Compass,
  Anchor,
  Thermometer,
  Navigation,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useInstrumentStore } from "@/lib/store/instrument-store";
import {
  BluetoothNMEAManager,
  getBluetoothManager,
} from "@/lib/instruments/bluetooth-manager";
import type { NMEAData } from "@/lib/instruments/nmea-parser";

function DataRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-xs font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

export default function InstrumentsPage() {
  const {
    connectionStatus,
    connectedDevice,
    errorMessage,
    data,
    dataSource,
    setConnectionStatus,
    setConnectedDevice,
    setData,
    setDataSource,
  } = useInstrumentStore();

  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setIsSupported(BluetoothNMEAManager.isSupported());
  }, []);

  // Wire up manager
  useEffect(() => {
    const manager = getBluetoothManager();

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
    const manager = getBluetoothManager();
    if (connectionStatus === "connected") {
      manager.disconnect();
    } else {
      await manager.connect();
    }
  }, [connectionStatus]);

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-foreground">Instruments</h1>
          <p className="text-xs text-muted-foreground">
            Connect onboard wind, speed, and depth sensors via Bluetooth
          </p>
        </div>
      </div>

      {/* Not supported warning */}
      {isSupported === false && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <BluetoothOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Bluetooth Not Available
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Web Bluetooth requires a supported browser (Chrome, Edge, or
                Opera on Android/macOS/Windows). Safari on iOS does not yet
                support Web Bluetooth. You can still use GPS for speed and
                position data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connection card */}
      {isSupported !== false && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Connection
            </span>
          </div>

          {isConnected && connectedDevice && (
            <div className="rounded-lg bg-ocean/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <Bluetooth className="h-4 w-4 text-ocean" />
                <span className="text-sm font-medium text-ocean">
                  {connectedDevice.name}
                </span>
              </div>
              {data && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {data.sentenceCount} NMEA sentences received
                </p>
              )}
            </div>
          )}

          {errorMessage && connectionStatus === "error" && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2">
              <p className="text-xs text-red-500">{errorMessage}</p>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={isConnecting || isSupported === null}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
              isConnected
                ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                : "bg-ocean text-white hover:bg-ocean-600"
            } disabled:opacity-50`}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning for devices...
              </>
            ) : isConnected ? (
              <>
                <Unplug className="h-4 w-4" />
                Disconnect
              </>
            ) : (
              <>
                <Bluetooth className="h-4 w-4" />
                Connect NMEA Device
              </>
            )}
          </button>
        </div>
      )}

      {/* Live data display */}
      {isConnected && data && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Live Data
            </span>
          </div>

          <div className="space-y-1.5">
            {data.apparentWindSpeed !== null && (
              <DataRow
                icon={<Wind className="h-3.5 w-3.5" />}
                label="Apparent Wind"
                value={`${data.apparentWindAngle ?? "—"}\u00B0 at ${data.apparentWindSpeed.toFixed(1)} kts`}
              />
            )}
            {data.trueWindSpeed !== null && (
              <DataRow
                icon={<Wind className="h-3.5 w-3.5" />}
                label="True Wind"
                value={`${data.trueWindAngle ?? "—"}\u00B0 at ${data.trueWindSpeed.toFixed(1)} kts`}
              />
            )}
            {data.boatSpeedKts !== null && (
              <DataRow
                icon={<Gauge className="h-3.5 w-3.5" />}
                label="Boat Speed"
                value={`${data.boatSpeedKts.toFixed(1)} kts`}
              />
            )}
            {data.speedOverGround !== null && (
              <DataRow
                icon={<Navigation className="h-3.5 w-3.5" />}
                label="SOG"
                value={`${data.speedOverGround.toFixed(1)} kts`}
              />
            )}
            {data.headingTrue !== null && (
              <DataRow
                icon={<Compass className="h-3.5 w-3.5" />}
                label="Heading"
                value={`${data.headingTrue}\u00B0T`}
              />
            )}
            {data.courseOverGround !== null && (
              <DataRow
                icon={<Compass className="h-3.5 w-3.5" />}
                label="COG"
                value={`${data.courseOverGround}\u00B0T`}
              />
            )}
            {data.depthMeters !== null && (
              <DataRow
                icon={<Anchor className="h-3.5 w-3.5" />}
                label="Depth"
                value={`${data.depthMeters.toFixed(1)} m`}
              />
            )}
            {data.waterTempCelsius !== null && (
              <DataRow
                icon={<Thermometer className="h-3.5 w-3.5" />}
                label="Water Temp"
                value={`${data.waterTempCelsius.toFixed(1)}\u00B0C`}
              />
            )}
            {data.apparentWindSpeed === null &&
              data.boatSpeedKts === null &&
              data.depthMeters === null && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  Waiting for instrument data...
                </p>
              )}
          </div>
        </div>
      )}

      {/* Data source preference */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Speed Data Source
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choose where the speedometer and GPS tracker get their data.
          &quot;Auto&quot; uses instruments when connected, GPS otherwise.
        </p>
        <div className="flex gap-2">
          {(["auto", "instruments", "gps"] as const).map((source) => (
            <button
              key={source}
              onClick={() => setDataSource(source)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                dataSource === source
                  ? "bg-ocean text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {source === "auto"
                ? "Auto"
                : source === "instruments"
                  ? "Instruments"
                  : "GPS Only"}
            </button>
          ))}
        </div>
      </div>

      {/* Compatible devices info */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Compatible Devices
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          MagellAIn works with Bluetooth NMEA multiplexers that output NMEA
          0183 sentences over BLE. Compatible devices include:
        </p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
            Yacht Devices YDWG-02 / YDNB-07
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
            Digital Yacht NavLink2 / iKommunicate
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
            Vesper Marine Cortex / XB-8000
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
            Actisense W2K-1 / NGW-1
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
            Any HM-10/HM-19 BLE serial bridge
          </li>
        </ul>
      </div>
    </div>
  );
}
