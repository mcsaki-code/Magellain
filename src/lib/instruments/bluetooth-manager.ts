// ============================================================
// Web Bluetooth Manager for NMEA Instrument Connections
// Connects to BLE NMEA multiplexers (e.g., Yacht Devices,
// Digital Yacht, Vesper Marine, Actisense) that expose a
// Nordic UART Service (NUS) or similar serial-over-BLE profile.
// ============================================================

import { parseNMEABuffer, createEmptyNMEAData, type NMEAData } from "./nmea-parser";

// Common BLE service UUIDs for marine NMEA multiplexers
const KNOWN_SERVICES = {
  // Nordic UART Service (used by most marine BLE devices)
  NORDIC_UART: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  // TX characteristic (device sends NMEA data on this)
  NORDIC_UART_TX: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
  // RX characteristic (we write to device on this)
  NORDIC_UART_RX: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  // Generic HM-10/HM-19 BLE serial modules
  HM_SERIAL: "0000ffe0-0000-1000-8000-00805f9b34fb",
  HM_SERIAL_CHAR: "0000ffe1-0000-1000-8000-00805f9b34fb",
};

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
  lastSeen: number;
}

type DataCallback = (data: NMEAData) => void;
type StatusCallback = (status: ConnectionStatus, message?: string) => void;

export class BluetoothNMEAManager {
  private device: globalThis.BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private nmeaData: NMEAData = createEmptyNMEAData();
  private buffer = "";
  private dataCallbacks: DataCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private status: ConnectionStatus = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private decoder = new TextDecoder();

  /** Check if Web Bluetooth is available */
  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  /** Get current connection status */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** Get current NMEA data snapshot */
  getData(): NMEAData {
    return { ...this.nmeaData };
  }

  /** Get connected device info */
  getDevice(): BluetoothDevice | null {
    if (!this.device) return null;
    return {
      id: this.device.id,
      name: this.device.name || "Unknown Device",
      connected: this.device.gatt?.connected || false,
      lastSeen: this.nmeaData.lastUpdate,
    };
  }

  /** Subscribe to NMEA data updates */
  onData(callback: DataCallback): () => void {
    this.dataCallbacks.push(callback);
    return () => {
      this.dataCallbacks = this.dataCallbacks.filter((cb) => cb !== callback);
    };
  }

  /** Subscribe to connection status changes */
  onStatus(callback: StatusCallback): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback);
    };
  }

  private setStatus(status: ConnectionStatus, message?: string) {
    this.status = status;
    this.statusCallbacks.forEach((cb) => cb(status, message));
  }

  private emitData() {
    const snapshot = { ...this.nmeaData };
    this.dataCallbacks.forEach((cb) => cb(snapshot));
  }

  /**
   * Request a BLE device and connect to its NMEA stream.
   * This MUST be called in response to a user gesture (click/tap).
   */
  async connect(): Promise<void> {
    if (!BluetoothNMEAManager.isSupported()) {
      this.setStatus("error", "Bluetooth not available on this device");
      return;
    }

    this.setStatus("connecting");

    try {
      // Request device — show picker to user
      this.device = await navigator.bluetooth.requestDevice({
        // Accept any device advertising our known services
        filters: [
          { services: [KNOWN_SERVICES.NORDIC_UART] },
          { services: [KNOWN_SERVICES.HM_SERIAL] },
        ],
        // Also accept name-based matching for devices that don't advertise services
        optionalServices: [
          KNOWN_SERVICES.NORDIC_UART,
          KNOWN_SERVICES.HM_SERIAL,
        ],
      }).catch(() => {
        // User might cancel — try broader acceptance
        return navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            KNOWN_SERVICES.NORDIC_UART,
            KNOWN_SERVICES.HM_SERIAL,
          ],
        });
      });

      if (!this.device) {
        this.setStatus("disconnected");
        return;
      }

      // Listen for disconnect
      this.device.addEventListener("gattserverdisconnected", () => {
        this.setStatus("disconnected", "Device disconnected");
        this.characteristic = null;
        // Auto-reconnect after 3 seconds
        this.reconnectTimer = setTimeout(() => this.tryReconnect(), 3000);
      });

      await this.connectToGATT();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      this.setStatus("error", message);
    }
  }

  /** Connect to GATT server and subscribe to notifications */
  private async connectToGATT(): Promise<void> {
    if (!this.device?.gatt) {
      this.setStatus("error", "No GATT server available");
      return;
    }

    const server = await this.device.gatt.connect();

    // Try Nordic UART first, then HM-10
    let service: BluetoothRemoteGATTService | null = null;
    let txCharUUID: string;

    try {
      service = await server.getPrimaryService(KNOWN_SERVICES.NORDIC_UART);
      txCharUUID = KNOWN_SERVICES.NORDIC_UART_TX;
    } catch {
      try {
        service = await server.getPrimaryService(KNOWN_SERVICES.HM_SERIAL);
        txCharUUID = KNOWN_SERVICES.HM_SERIAL_CHAR;
      } catch {
        this.setStatus("error", "No compatible NMEA service found on device");
        return;
      }
    }

    this.characteristic = await service.getCharacteristic(txCharUUID);
    await this.characteristic.startNotifications();
    this.characteristic.addEventListener("characteristicvaluechanged", this.handleNotification);

    this.nmeaData = createEmptyNMEAData();
    this.buffer = "";
    this.setStatus("connected", this.device.name || "Connected");
  }

  /** Handle incoming BLE notification (chunk of NMEA data) */
  private handleNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) return;

    // Decode raw bytes to string
    const chunk = this.decoder.decode(target.value);
    this.buffer += chunk;

    // Process complete sentences (terminated by \r\n or \n)
    const lastNewline = this.buffer.lastIndexOf("\n");
    if (lastNewline < 0) return;

    const complete = this.buffer.slice(0, lastNewline + 1);
    this.buffer = this.buffer.slice(lastNewline + 1);

    parseNMEABuffer(complete, this.nmeaData);
    this.emitData();
  };

  /** Try to reconnect to a previously paired device */
  private async tryReconnect(): Promise<void> {
    if (!this.device?.gatt) return;
    if (this.device.gatt.connected) return;

    this.setStatus("connecting", "Reconnecting...");
    try {
      await this.connectToGATT();
    } catch {
      // Retry in 5 seconds
      this.reconnectTimer = setTimeout(() => this.tryReconnect(), 5000);
    }
  }

  /** Disconnect from the current device */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.characteristic) {
      try {
        this.characteristic.removeEventListener("characteristicvaluechanged", this.handleNotification);
        this.characteristic.stopNotifications().catch(() => {});
      } catch {
        // Ignore cleanup errors
      }
      this.characteristic = null;
    }

    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }

    this.device = null;
    this.buffer = "";
    this.setStatus("disconnected");
  }

  /** Destroy the manager and clean up all resources */
  destroy(): void {
    this.disconnect();
    this.dataCallbacks = [];
    this.statusCallbacks = [];
  }
}

// Singleton instance for app-wide use
let instance: BluetoothNMEAManager | null = null;

export function getBluetoothManager(): BluetoothNMEAManager {
  if (!instance) {
    instance = new BluetoothNMEAManager();
  }
  return instance;
}
