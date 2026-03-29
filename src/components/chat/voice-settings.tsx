"use client";

import { useState, useEffect } from "react";
import { Settings2, Play, X } from "lucide-react";

interface VoiceSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
}

const STORAGE_KEY = "magellain-voice-settings";

export function getVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return { voiceURI: "", rate: 1.0, pitch: 1.0 };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { voiceURI: "", rate: 1.0, pitch: 1.0 };
}

export function saveVoiceSettings(settings: VoiceSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function VoiceSettingsPanel({ onClose }: { onClose: () => void }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>(getVoiceSettings());
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    function loadVoices() {
      const available = window.speechSynthesis.getVoices();
      // Prefer English voices, sort by name
      const english = available
        .filter((v) => v.lang.startsWith("en"))
        .sort((a, b) => a.name.localeCompare(b.name));
      setVoices(english.length > 0 ? english : available);
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const handleChange = (key: keyof VoiceSettings, value: string | number) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveVoiceSettings(next);
  };

  const preview = () => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(
      "Wind is building from the southwest at 12 knots, gusting 18. Favor the right side on this beat."
    );
    if (settings.voiceURI) {
      const voice = voices.find((v) => v.voiceURI === settings.voiceURI);
      if (voice) utter.voice = voice;
    }
    utter.rate = settings.rate;
    utter.pitch = settings.pitch;
    utter.onstart = () => setPreviewing(true);
    utter.onend = () => setPreviewing(false);
    utter.onerror = () => setPreviewing(false);
    window.speechSynthesis.speak(utter);
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-ocean" />
          <h3 className="text-sm font-semibold">Voice Settings</h3>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Voice selection */}
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Voice
          </label>
          <select
            value={settings.voiceURI}
            onChange={(e) => handleChange("voiceURI", e.target.value)}
            className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-xs"
          >
            <option value="">System default</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} {v.lang !== "en-US" ? `(${v.lang})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Speed
            </label>
            <span className="text-[10px] text-muted-foreground">{settings.rate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.rate}
            onChange={(e) => handleChange("rate", parseFloat(e.target.value))}
            className="mt-1 w-full accent-ocean"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/60">
            <span>Slow</span>
            <span>Normal</span>
            <span>Fast</span>
          </div>
        </div>

        {/* Pitch */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Pitch
            </label>
            <span className="text-[10px] text-muted-foreground">{settings.pitch.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.pitch}
            onChange={(e) => handleChange("pitch", parseFloat(e.target.value))}
            className="mt-1 w-full accent-ocean"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground/60">
            <span>Low</span>
            <span>Normal</span>
            <span>High</span>
          </div>
        </div>

        {/* Preview */}
        <button
          onClick={preview}
          disabled={previewing}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-ocean/30 bg-ocean/5 py-2 text-xs font-medium text-ocean transition-colors hover:bg-ocean/10 disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          {previewing ? "Speaking..." : "Preview Voice"}
        </button>
      </div>
    </div>
  );
}
