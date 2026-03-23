"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Header } from "@/components/layout/header";
import { useChatStore } from "@/lib/store/chat-store";
import { Send, Trash2, Loader2, Sailboat } from "lucide-react";

function MessageBubble({ role, content }: { role: "user" | "assistant"; content: string }) {
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
      <div className="prose prose-sm dark:prose-invert max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-1.5 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0.5 [&_strong]:text-foreground">
        {content ? (
          <ReactMarkdown>{content}</ReactMarkdown>
        ) : (
          <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-muted-foreground/30" />
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, isStreaming, error, sendMessage, clearMessages } = useChatStore();

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col">
      <Header title="Sailing Coach">
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
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
            <div className="grid w-full max-w-sm gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    inputRef.current?.focus();
                  }}
                  className="rounded-xl border bg-card p-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
            ))}
          </div>
        )}

        {error && (
          <div className="mt-2 rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-500">
            {error}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t bg-background p-3 pb-safe-bottom">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your sailing coach..."
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
