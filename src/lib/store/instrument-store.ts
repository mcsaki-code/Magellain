import { create } from "zustand";
import type { NMEAData } from "@/lib/instruments/nmea-parser";
import type { ConnectionStatus, BluetoothDevice } from "@/lib/instruments/bluetooth-manager";

// ─── Instrument Store ────────────────────────────────────────
// Centralizes real-time instrument data from Bluetooth NMEA
// devices. Components subscribe to slices they need.
// ─────────────────────────────────────────────────────────────

interface InstrumentState {
  // Connection
  connectionStatus: ConnectionStatus;
  connectedDevice: BluetoothDevice | null;
  errorMessage: string | null;

  // Live NMEA data
  data: NMEAData | null;

  // Display preferences
  showInstrumentPanel: boolean;
  dataSource: "gps" | "instruments" | "auto"; // auto = prefer instruments when available

  // Actions
  setConnectionStatus: (status: ConnectionStatus, message?: string) => void;
  setConnectedDevice: (device: BluetoothDevice | null) => void;
  setData: (data: NMEAData) => void;
  toggleInstrumentPanel: () => void;
  setDataSource: (source: "gps" | "instruments" | "auto") => void;
  reset: () => void;
}

export const useInstrumentStore = create<InstrumentState>((set) => ({
  connectionStatus: "disconnected",
  connectedDevice: null,
  errorMessage: null,
  data: null,
  showInstrumentPanel: false,
  dataSource: "auto",

  setConnectionStatus: (status, message) =>
    set({
      connectionStatus: status,
      errorMessage: message || null,
    }),

  setConnectedDevice: (device) => set({ connectedDevice: device }),

  setData: (data) => set({ data }),

  toggleInstrumentPanel: () =>
    set((s) => ({ showInstrumentPanel: !s.showInstrumentPanel })),

  setDataSource: (source) => set({ dataSource: source }),

  reset: () =>
    set({
      connectionStatus: "disconnected",
      connectedDevice: null,
      errorMessage: null,
      data: null,
    }),
}));
