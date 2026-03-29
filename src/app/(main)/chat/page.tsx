"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Header } from "@/components/layout/header";
import { useChatStore } from "@/lib/store/chat-store";
import { Send, Trash2, Loader2, Sailboat, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { trackEvent } from "@/lib/telemetry/tracker";

// Web Speech API type declarations
interface ISpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface ISpeechRecognitionResultList {
  length: number;
  [index: number]: ISpeechRecognitionResult;
}
interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ISpeechRecognitionResultList;
}
interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

// ─── Voice Output (Text-to-Speech) ──────────────────────
function useVoiceOutput() {
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const speak = useCallback((text: string) => {
    if (!ttsSupported || !voiceEnabled) return;
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Strip markdown formatting for cleaner speech
    const clean = text
      .replace(/#{1,6}\s/g, "")          // headers
      .replace(/\*\*(.+?)\*\*/g, "$1")   // bold
      .replace(/\*(.+?)\*/g, "$1")       // italic
      .replace(/`(.+?)`/g, "$1")         // code
      .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
      .replace(/[-*]\s/g, "")            // bullets
      .replace(/\n{2,}/g, ". ")          // paragraph breaks
      .replace(/\n/g, " ")              // line breaks
      .trim();

    if (!clean) return;

    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.lang = "en-US";
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
    trackEvent("voice_output_speak", { length: clean.length });
  }, [ttsSupported, voiceEnabled]);

  const stop = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [ttsSupported]);

  const toggle = useCallback(() => {
    if (speaking) {
      stop();
    }
    setVoiceEnabled((prev) => {
      const next = !prev;
      trackEvent("voice_output_toggle", { enabled: next });
      if (!next) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      }
      return next;
    });
  }, [speaking, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  return { speaking, voiceEnabled, ttsSupported, speak, stop, toggle };
}

function MessageBubble({
  role,
  content,
  onSpeak,
  speaking,
  voiceEnabled,
}: {
  role: "user" | "assistant";
  content: string;
  onSpeak?: (text: string) => void;
  speaking?: boolean;
  voiceEnabled?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ocean px-4 py-2.5 text-sm text-white">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-2">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-100 dark:bg-navy-800">
        <Sailboat className="h-3.5 w-3.5 text-navy-600 dark:text-navy-300" />
      </div>
      <div className="group relative max-w-[85%]">
        <div className="prose prose-sm dark:prose-invert rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-1.5 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0.5 [&_strong]:text-foreground">
          {content ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : (
            <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-muted-foreground/30" />
          )}
        </div>
        {/* Voice output button on assistant messages */}
        {voiceEnabled && content && onSpeak && (
          <button
            onClick={() => onSpeak(content)}
            className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-ocean"
            title={speaking ? "Speaking..." : "Read aloud"}
          >
            <Volume2 className={`h-3 w-3 ${speaking ? "text-ocean animate-pulse" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "What sail should I use in 12-15 knots upwind?",
  "Explain port-starboard right of way rules",
  "How do lake breezes work on Lake Erie?",
  "Tips for a good start in a fleet race?",
];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChatStore();
  const { speaking, voiceEnabled, ttsSupported, speak, stop, toggle: toggleTTS } = useVoiceOutput();

  // Auto-speak new assistant messages when voice output is enabled
  const lastMsgRef = useRef<string>("");
  useEffect(() => {
    if (!voiceEnabled || isStreaming) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && lastMsg.content && lastMsg.content !== lastMsgRef.current) {
      lastMsgRef.current = lastMsg.content;
      speak(lastMsg.content);
    }
  }, [messages, isStreaming, voiceEnabled, speak]);

  // Check for Web Speech API support
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognitionAPI);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    // Stop any ongoing speech when user sends a new message
    stop();
    setInput("");
    sendMessage(trimmed);
    trackEvent("coach_message_sent", { length: trimmed.length });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = useCallback(() => {
    setVoiceError(null);

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsListening(true);
      finalTranscript = "";
      trackEvent("voice_input_start");
    };

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      setInput(finalTranscript || interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      inputRef.current?.focus();
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (event.error === "not-allowed") {
        setVoiceError("Microphone access denied. Allow microphone in browser settings.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setVoiceError("Voice input error. Please try again.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--nav-total-height))] w-full max-w-2xl flex-col">
      <Header title="Sailing Coach">
        <div className="flex items-center gap-1">
          {/* Voice output toggle */}
          {ttsSupported && (
            <button
              onClick={toggleTTS}
              className={`rounded-lg p-2 transition-colors ${
                voiceEnabled
                  ? "text-ocean bg-ocean/10"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              title={voiceEnabled ? "Voice output on — tap to mute" : "Enable voice output"}
            >
              {voiceEnabled ? (
                <Volume2 className={`h-4 w-4 ${speaking ? "animate-pulse" : ""}`} />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => {
                stop();
                clearMessages();
              }}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </Header>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-100 dark:bg-navy-800">
              <Sailboat className="h-8 w-8 text-navy-600 dark:text-navy-300" />
            </div>
            <h2 className="mb-1 text-lg font-semibold">MagellAIn Coach</h2>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Your AI sailing coach for racing tactics,<br />
              weather strategy, and Lake Erie knowledge
            </p>
            {voiceSupported && (
              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mic className="h-3.5 w-3.5" />
                Tap the mic to speak your question
              </p>
            )}
            {ttsSupported && (
              <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Volume2 className="h-3.5 w-3.5" />
                Enable voice output to hear responses read aloud
              </p>
            )}
            <div className="grid w-full max-w-sm gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    if (!isStreaming) {
                      setInput("");
                      sendMessage(s);
                      trackEvent("coach_suggestion_tap", { suggestion: s.slice(0, 40) });
                    }
                  }}
                  disabled={isStreaming}
                  className="rounded-xl border bg-card p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                onSpeak={speak}
                speaking={speaking}
                voiceEnabled={voiceEnabled}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-2 rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-500">
            {error}
          </div>
        )}
      </div>

      {/* Voice error */}
      {voiceError && (
        <div className="mx-4 mb-1 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">
          {voiceError}
        </div>
      )}

      {/* Listening indicator */}
      {isListening && (
        <div className="mx-4 mb-1 flex items-center gap-2 rounded-lg bg-ocean/10 px-3 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ocean opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ocean" />
          </span>
          <span className="text-xs font-medium text-ocean">Listening... speak now</span>
        </div>
      )}

      {/* Speaking indicator */}
      {speaking && (
        <div className="mx-4 mb-1 flex items-center gap-2 rounded-lg bg-ocean/5 px-3 py-2">
          <Volume2 className="h-3.5 w-3.5 text-ocean animate-pulse" />
          <span className="text-xs font-medium text-ocean">Speaking...</span>
          <button
            onClick={stop}
            className="ml-auto text-[10px] font-medium text-ocean/70 hover:text-ocean"
          >
            Stop
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t bg-background p-3">
        <div className="flex items-center gap-2">
          {/* Voice input button */}
          {voiceSupported && (
            <button
              onClick={toggleVoice}
              disabled={isStreaming}
              title={isListening ? "Stop listening" : "Speak your question"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-40 ${
                isListening
                  ? "border-ocean bg-ocean text-white"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Ask your sailing coach..."}
            disabled={isStreaming}
            className="flex-1 rounded-xl border bg-muted px-4 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean text-white transition-colors hover:bg-ocean-600 disabled:opacity-40"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
