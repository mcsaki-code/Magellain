// ============================================================
// NMEA 0183 Parser for sailing instruments
// Supports common marine sentences from wind, speed, heading,
// depth, and temperature sensors.
// ============================================================

export interface NMEAData {
  // Wind
  apparentWindAngle: number | null;   // degrees relative to bow
  apparentWindSpeed: number | null;   // knots
  trueWindAngle: number | null;       // degrees relative to bow
  trueWindSpeed: number | null;       // knots
  trueWindDirection: number | null;   // degrees magnetic

  // Boat speed & heading
  boatSpeedKts: number | null;        // speed through water (knots)
  speedOverGround: number | null;     // SOG (knots)
  courseOverGround: number | null;    // COG (degrees true)
  headingMagnetic: number | null;     // degrees magnetic
  headingTrue: number | null;         // degrees true

  // Depth & temperature
  depthMeters: number | null;         // depth below transducer
  waterTempCelsius: number | null;    // water temperature

  // Position (from GPS sentences relayed via instruments)
  latitude: number | null;
  longitude: number | null;

  // Metadata
  lastUpdate: number;                 // epoch ms
  sentenceCount: number;
}

export function createEmptyNMEAData(): NMEAData {
  return {
    apparentWindAngle: null,
    apparentWindSpeed: null,
    trueWindAngle: null,
    trueWindSpeed: null,
    trueWindDirection: null,
    boatSpeedKts: null,
    speedOverGround: null,
    courseOverGround: null,
    headingMagnetic: null,
    headingTrue: null,
    depthMeters: null,
    waterTempCelsius: null,
    latitude: null,
    longitude: null,
    lastUpdate: 0,
    sentenceCount: 0,
  };
}

/** Validate NMEA checksum (XOR of chars between $ and *) */
function validateChecksum(sentence: string): boolean {
  const starIdx = sentence.indexOf("*");
  if (starIdx < 0 || starIdx + 3 > sentence.length) return false;

  const body = sentence.slice(sentence.indexOf("$") + 1, starIdx);
  let checksum = 0;
  for (let i = 0; i < body.length; i++) {
    checksum ^= body.charCodeAt(i);
  }

  const expected = parseInt(sentence.slice(starIdx + 1, starIdx + 3), 16);
  return checksum === expected;
}

/** Convert NMEA lat/lon (DDMM.MMMM) to decimal degrees */
function nmeaToDecimal(raw: string, hemisphere: string): number | null {
  if (!raw || !hemisphere) return null;
  const isLat = hemisphere === "N" || hemisphere === "S";
  const degLen = isLat ? 2 : 3;
  const deg = parseInt(raw.slice(0, degLen), 10);
  const min = parseFloat(raw.slice(degLen));
  if (isNaN(deg) || isNaN(min)) return null;
  const decimal = deg + min / 60;
  return hemisphere === "S" || hemisphere === "W" ? -decimal : decimal;
}

/** Convert wind speed to knots based on unit indicator */
function toKnots(value: number, unit: string): number {
  switch (unit.toUpperCase()) {
    case "N": return value;              // already knots
    case "M": return value * 1.94384;    // m/s to knots
    case "K": return value * 0.539957;   // km/h to knots
    default: return value;
  }
}

/**
 * Parse a single NMEA 0183 sentence and update the data object.
 * Returns the updated data (same reference, mutated in place for perf).
 */
export function parseNMEASentence(sentence: string, data: NMEAData): NMEAData {
  const trimmed = sentence.trim();
  if (!trimmed.startsWith("$") && !trimmed.startsWith("!")) return data;

  // Checksum validation (skip if no checksum present — some devices omit it)
  if (trimmed.includes("*") && !validateChecksum(trimmed)) return data;

  // Strip checksum for parsing
  const clean = trimmed.includes("*") ? trimmed.slice(0, trimmed.indexOf("*")) : trimmed;
  const parts = clean.split(",");
  const sentenceId = parts[0].slice(parts[0].length - 3); // last 3 chars (e.g., MWV, VHW)

  data.lastUpdate = Date.now();
  data.sentenceCount++;

  switch (sentenceId) {
    // ── MWV — Wind Speed and Angle ──────────────────────────
    case "MWV": {
      const angle = parseFloat(parts[1]);
      const ref = parts[2]; // R = relative (apparent), T = true
      const speed = parseFloat(parts[3]);
      const unit = parts[4];
      const status = parts[5];
      if (status !== "A" || isNaN(angle) || isNaN(speed)) break;

      const kts = toKnots(speed, unit);
      if (ref === "R") {
        data.apparentWindAngle = Math.round(angle);
        data.apparentWindSpeed = Math.round(kts * 10) / 10;
      } else if (ref === "T") {
        data.trueWindAngle = Math.round(angle);
        data.trueWindSpeed = Math.round(kts * 10) / 10;
      }
      break;
    }

    // ── MWD — Wind Direction and Speed (true) ───────────────
    case "MWD": {
      const dirTrue = parseFloat(parts[1]);
      const dirMag = parseFloat(parts[3]);
      const spdKts = parseFloat(parts[5]);
      const spdMs = parseFloat(parts[7]);

      if (!isNaN(dirTrue)) data.trueWindDirection = Math.round(dirTrue);
      else if (!isNaN(dirMag)) data.trueWindDirection = Math.round(dirMag);
      if (!isNaN(spdKts)) data.trueWindSpeed = Math.round(spdKts * 10) / 10;
      else if (!isNaN(spdMs)) data.trueWindSpeed = Math.round(spdMs * 1.94384 * 10) / 10;
      break;
    }

    // ── VHW — Water Speed and Heading ───────────────────────
    case "VHW": {
      const hdgTrue = parseFloat(parts[1]);
      const hdgMag = parseFloat(parts[3]);
      const spdKts = parseFloat(parts[5]);

      if (!isNaN(hdgTrue)) data.headingTrue = Math.round(hdgTrue);
      if (!isNaN(hdgMag)) data.headingMagnetic = Math.round(hdgMag);
      if (!isNaN(spdKts)) data.boatSpeedKts = Math.round(spdKts * 10) / 10;
      break;
    }

    // ── HDG — Heading, Deviation, Variation ─────────────────
    case "HDG": {
      const hdg = parseFloat(parts[1]);
      if (!isNaN(hdg)) data.headingMagnetic = Math.round(hdg);

      // Apply variation if available to compute true heading
      const variation = parseFloat(parts[4]);
      const varDir = parts[5];
      if (!isNaN(hdg) && !isNaN(variation)) {
        const sign = varDir === "W" ? -1 : 1;
        data.headingTrue = Math.round((hdg + sign * variation + 360) % 360);
      }
      break;
    }

    // ── HDT — Heading True ──────────────────────────────────
    case "HDT": {
      const hdg = parseFloat(parts[1]);
      if (!isNaN(hdg)) data.headingTrue = Math.round(hdg);
      break;
    }

    // ── RMC — Recommended Minimum (GPS position + SOG/COG) ─
    case "RMC": {
      const status = parts[2];
      if (status !== "A") break; // V = void/invalid

      const lat = nmeaToDecimal(parts[3], parts[4]);
      const lon = nmeaToDecimal(parts[5], parts[6]);
      const sog = parseFloat(parts[7]);
      const cog = parseFloat(parts[8]);

      if (lat !== null) data.latitude = lat;
      if (lon !== null) data.longitude = lon;
      if (!isNaN(sog)) data.speedOverGround = Math.round(sog * 10) / 10;
      if (!isNaN(cog)) data.courseOverGround = Math.round(cog);
      break;
    }

    // ── GGA — GPS Fix Quality ───────────────────────────────
    case "GGA": {
      const lat = nmeaToDecimal(parts[2], parts[3]);
      const lon = nmeaToDecimal(parts[4], parts[5]);
      if (lat !== null) data.latitude = lat;
      if (lon !== null) data.longitude = lon;
      break;
    }

    // ── DBT — Depth Below Transducer ────────────────────────
    case "DBT": {
      // Try meters first, then feet, then fathoms
      const meters = parseFloat(parts[3]);
      const feet = parseFloat(parts[1]);
      const fathoms = parseFloat(parts[5]);

      if (!isNaN(meters)) data.depthMeters = Math.round(meters * 10) / 10;
      else if (!isNaN(feet)) data.depthMeters = Math.round(feet * 0.3048 * 10) / 10;
      else if (!isNaN(fathoms)) data.depthMeters = Math.round(fathoms * 1.8288 * 10) / 10;
      break;
    }

    // ── DPT — Depth ─────────────────────────────────────────
    case "DPT": {
      const depth = parseFloat(parts[1]);
      const offset = parseFloat(parts[2]) || 0;
      if (!isNaN(depth)) data.depthMeters = Math.round((depth + offset) * 10) / 10;
      break;
    }

    // ── MTW — Water Temperature ─────────────────────────────
    case "MTW": {
      const temp = parseFloat(parts[1]);
      const unit = parts[2];
      if (!isNaN(temp)) {
        data.waterTempCelsius = unit === "F"
          ? Math.round((temp - 32) * 5 / 9 * 10) / 10
          : Math.round(temp * 10) / 10;
      }
      break;
    }

    // ── VTG — Track Made Good / Ground Speed ────────────────
    case "VTG": {
      const cogTrue = parseFloat(parts[1]);
      const sogKts = parseFloat(parts[5]);
      if (!isNaN(cogTrue)) data.courseOverGround = Math.round(cogTrue);
      if (!isNaN(sogKts)) data.speedOverGround = Math.round(sogKts * 10) / 10;
      break;
    }

    default:
      // Unknown sentence — ignore silently
      break;
  }

  return data;
}

/**
 * Parse a buffer of NMEA data (may contain multiple sentences
 * separated by \r\n or \n). Returns updated data object.
 */
export function parseNMEABuffer(buffer: string, data: NMEAData): NMEAData {
  const lines = buffer.split(/\r?\n/);
  for (const line of lines) {
    if (line.length > 5) parseNMEASentence(line, data);
  }
  return data;
}
