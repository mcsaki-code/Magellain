// ─── Database Types ──────────────────────────────────────────────────
// These mirror the Supabase schema. Will be replaced by generated types
// from `supabase gen types` once the schema is deployed.

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  club_affiliations: string[];
  sailing_experience: "beginner" | "intermediate" | "advanced" | "expert" | null;
  certifications: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Boat {
  id: string;
  owner_id: string;
  name: string;
  class_name: string;
  hull_type: "monohull" | "multihull";
  loa_ft: number | null;
  beam_ft: number | null;
  draft_ft: number | null;
  displacement_lbs: number | null;
  sail_number: string | null;
  phrf_rating: number | null;
  one_design_class: string | null;
  year_built: number | null;
  manufacturer: string | null;
  model: string | null;
  sail_inventory: SailInventory | null;
  photo_url: string | null;
  is_primary: boolean;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SailInventory {
  main?: { area_sqft?: number; type?: string };
  jib?: { area_sqft?: number; type?: string };
  genoa?: { area_sqft?: number; type?: string };
  spinnaker?: { area_sqft?: number; type?: string };
  [key: string]: { area_sqft?: number; type?: string } | undefined;
}

export interface WeatherStation {
  id: string;
  station_id: string;
  name: string;
  lat: number;
  lng: number;
  station_type: "buoy" | "coastal" | "ship";
  data_source: "ndbc" | "nws" | "glerl";
  is_active: boolean;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface WeatherObservation {
  id: string;
  station_id: string;
  observed_at: string;
  wind_speed_kts: number | null;
  wind_direction_deg: number | null;
  wind_gust_kts: number | null;
  wave_height_ft: number | null;
  wave_period_sec: number | null;
  wave_direction_deg: number | null;
  air_temp_f: number | null;
  water_temp_f: number | null;
  barometric_pressure_mb: number | null;
  visibility_nm: number | null;
  dewpoint_f: number | null;
  humidity_pct: number | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface MarineForecast {
  id: string;
  zone_id: string;
  zone_name: string;
  period_name: string;
  forecast_text: string;
  hazards: string[];
  wind_speed_min_kts: number | null;
  wind_speed_max_kts: number | null;
  wind_direction: string | null;
  wave_height_min_ft: number | null;
  wave_height_max_ft: number | null;
  issued_at: string;
  expires_at: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface WeatherAlert {
  id: string;
  alert_id: string;
  event_type: string;
  severity: "minor" | "moderate" | "severe" | "extreme";
  urgency: "immediate" | "expected" | "future" | "past" | "unknown";
  headline: string;
  description: string;
  instruction: string | null;
  affected_zones: string[];
  onset: string | null;
  expires: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface Club {
  id: string;
  name: string;
  short_name: string;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface Regatta {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  series_type: "weekly" | "championship" | "invitational" | "distance";
  fleets: string[];
  is_active: boolean;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface Race {
  id: string;
  regatta_id: string;
  race_number: number;
  scheduled_start: string;
  actual_start: string | null;
  course_type: string | null;
  course_description: string | null;
  distance_nm: number | null;
  wind_speed_avg_kts: number | null;
  wind_direction_avg_deg: number | null;
  status: "scheduled" | "in_progress" | "completed" | "abandoned" | "postponed";
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface RaceResult {
  id: string;
  race_id: string;
  boat_id: string;
  fleet: string;
  finish_position: number | null;
  corrected_position: number | null;
  elapsed_time_sec: number | null;
  corrected_time_sec: number | null;
  status: "finished" | "dns" | "dnf" | "dsq" | "ocs" | "raf";
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  model: string;
  system_prompt_version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls: Record<string, unknown>[] | null;
  tool_results: Record<string, unknown>[] | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

export interface FloatPlan {
  id: string;
  user_id: string;
  boat_id: string | null;
  departure_time: string;
  expected_return: string;
  destination: string;
  route_description: string | null;
  crew_count: number;
  crew_names: string[];
  emergency_contacts: Record<string, unknown>[];
  status: "active" | "completed" | "overdue" | "cancelled";
  actual_return: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SystemConfig {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}
