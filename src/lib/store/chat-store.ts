import { create } from "zustand";

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatState {
  messages: ChatMsg[];
  isStreaming: boolean;
  sessionId: string | null;
  error: string | null;

  addMessage: (msg: ChatMsg) => void;
  updateLastAssistant: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  setSessionId: (id: string) => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  sendMessage: (content: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  sessionId: null,
  error: null,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastAssistant: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const lastIdx = msgs.findLastIndex((m) => m.role === "assistant");
      if (lastIdx >= 0) msgs[lastIdx] = { ...msgs[lastIdx], content };
      return { messages: msgs };
    }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setSessionId: (sessionId) => set({ sessionId }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [], sessionId: null }),

  sendMessage: async (content: string) => {
    const state = get();
    if (state.isStreaming) return;

    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      isStreaming: true,
      error: null,
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          sessionId: state.sessionId,
          history: state.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Chat failed" }));
        set({ error: errData.error || "Chat request failed", isStreaming: false });
        return;
      }

      // Add assistant message placeholder
      set((s) => ({
        messages: [...s.messages, { id: crypto.randomUUID(), role: "assistant", content: "", createdAt: new Date().toISOString() }],
        isStreaming: true,
      }));

      // Try streaming first, fall back to reading the full response as text
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            if (chunk) {
              set((s) => {
                const messages = [...s.messages];
                const last = messages[messages.length - 1];
                if (last) {
                  messages[messages.length - 1] = { ...last, content: last.content + chunk };
                }
                return { messages };
              });
            }
          }
        } finally {
          reader.releaseLock();
          set({ isStreaming: false });
        }
      } else {
        // Fallback: read the entire response as text (non-streaming)
        const text = await response.text();
        set((s) => {
          const messages = [...s.messages];
          const last = messages[messages.length - 1];
          if (last) {
            messages[messages.length - 1] = { ...last, content: text };
          }
          return { messages, isStreaming: false };
        });
      }
    } catch (err) {
      set({
        isStreaming: false,
        error: err instanceof Error ? err.message : "Chat failed",
      });
    }
  },
}));
