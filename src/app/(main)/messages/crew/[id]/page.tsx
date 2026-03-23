"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft, Send, Loader2, Users, UserPlus, Settings,
} from "lucide-react";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  message_type: string;
  created_at: string;
  sender_name?: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  display_name?: string;
}

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
}

export default function CrewChatPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  // Load initial data
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/sign-in"); return; }
      setCurrentUserId(user.id);

      // Load group info
      const { data: groupData } = await supabase
        .from("crew_groups")
        .select("*")
        .eq("id", groupId)
        .single();
      if (!groupData) { router.push("/messages"); return; }
      setGroup(groupData as GroupInfo);

      // Load members with profiles
      const { data: memberData } = await supabase
        .from("crew_members")
        .select("id, user_id, role")
        .eq("group_id", groupId);

      if (memberData) {
        const membersWithNames: Member[] = [];
        for (const m of memberData) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, full_name")
            .eq("id", m.user_id)
            .single();
          membersWithNames.push({
            ...m,
            display_name: profile?.display_name || profile?.full_name || "Unknown",
          });
        }
        setMembers(membersWithNames);
      }

      // Load messages
      const { data: msgData } = await supabase
        .from("crew_messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (msgData) {
        // Attach sender names
        const profileCache: Record<string, string> = {};
        for (const msg of msgData) {
          if (!profileCache[msg.sender_id]) {
            const { data: p } = await supabase
              .from("profiles")
              .select("display_name, full_name")
              .eq("id", msg.sender_id)
              .single();
            profileCache[msg.sender_id] = p?.display_name || p?.full_name || "Unknown";
          }
          (msg as Message).sender_name = profileCache[msg.sender_id];
        }
        setMessages(msgData as Message[]);
      }

      setLoading(false);
      scrollToBottom();
    }
    load();
  }, [groupId, router, supabase, scrollToBottom]);

  // Subscribe to new messages via Supabase Realtime
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`crew-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "crew_messages",
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch sender name
          const { data: p } = await supabase
            .from("profiles")
            .select("display_name, full_name")
            .eq("id", newMsg.sender_id)
            .single();
          newMsg.sender_name = p?.display_name || p?.full_name || "Unknown";

          setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, supabase, scrollToBottom]);

  async function sendMessage() {
    if (!input.trim() || sending || !currentUserId) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    await supabase.from("crew_messages").insert({
      group_id: groupId,
      sender_id: currentUserId,
      content,
    });

    setSending(false);
  }

  async function inviteMember() {
    if (!inviteEmail.trim()) return;
    // Look up user by email through profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", `%${inviteEmail.trim()}%`)
      .limit(1)
      .single();

    if (profile) {
      await supabase.from("crew_members").insert({
        group_id: groupId,
        user_id: profile.id,
        role: "member",
      });
      setInviteEmail("");
      // Reload members
      const { data: memberData } = await supabase
        .from("crew_members")
        .select("id, user_id, role")
        .eq("group_id", groupId);
      if (memberData) {
        const membersWithNames: Member[] = [];
        for (const m of memberData) {
          const { data: p } = await supabase
            .from("profiles")
            .select("display_name, full_name")
            .eq("id", m.user_id)
            .single();
          membersWithNames.push({
            ...m,
            display_name: p?.display_name || p?.full_name || "Unknown",
          });
        }
        setMembers(membersWithNames);
      }
    }
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-3 py-3">
        <button onClick={() => router.push("/messages")} className="rounded-lg p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{group?.name ?? "Crew Chat"}</h1>
          <p className="text-xs text-muted-foreground">{members.length} members</p>
        </div>
        <button
          onClick={() => setShowMembers(!showMembers)}
          className="rounded-lg p-2 hover:bg-muted"
        >
          <Users className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>

      {/* Members panel (slide in) */}
      {showMembers && (
        <div className="border-b bg-muted/30 p-4">
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">MEMBERS</h3>
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span>{m.display_name}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
          {/* Invite */}
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Search by name..."
              className="flex-1 rounded-lg border bg-card px-3 py-1.5 text-sm focus:border-ocean focus:outline-none"
            />
            <button
              onClick={inviteMember}
              disabled={!inviteEmail.trim()}
              className="rounded-lg bg-ocean px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Start the conversation with your crew
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => {
              const isMe = msg.sender_id === currentUserId;
              const showName = !isMe && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);

              return (
                <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] ${isMe ? "" : ""}`}>
                    {showName && (
                      <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                        {msg.sender_name}
                      </p>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2 text-sm ${
                        isMe
                          ? "rounded-br-md bg-ocean text-white"
                          : "rounded-bl-md bg-muted"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <p className={`mt-0.5 text-[10px] text-muted-foreground ${isMe ? "text-right" : ""}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-background p-3 pb-safe-bottom">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Message your crew..."
            className="flex-1 rounded-xl border bg-muted px-4 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-ocean focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocean text-white disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
