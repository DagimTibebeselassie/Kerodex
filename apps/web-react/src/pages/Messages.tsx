import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { listConversations } from '@/lib/api';
import { Button, Input, toast } from '@blinkdotnew/ui';
import {
  MessageSquare, Send, Car, ArrowLeft, Search, User, Circle,
} from 'lucide-react';
import { Message } from '@/types';

// ── Thread preview type ────────────────────────────────────────────────────
interface ThreadPreview {
  partnerId: string;
  vehicleId: string;
  lastMessage: string;
  lastAt: string;
  unread: boolean;
  vehicleTitle: string;
}

// ── Timestamp helper ───────────────────────────────────────────────────────
function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Thread List Item ───────────────────────────────────────────────────────
function ThreadItem({
  thread,
  selected,
  onSelect,
}: {
  thread: ThreadPreview;
  selected: boolean;
  onSelect: () => void;
}) {
  const initials = thread.partnerId.substring(0, 2).toUpperCase();

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left flex items-start gap-3 p-4 border-b border-border transition-colors hover:bg-muted/40 ${
        selected ? 'bg-primary/5 border-l-2 border-l-primary' : ''
      }`}
    >
      {/* Avatar */}
      <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[13px] shrink-0">
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold truncate">{thread.vehicleTitle || 'Vehicle Inquiry'}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(thread.lastAt)}</span>
        </div>
        <p className="text-[12px] text-muted-foreground truncate mt-0.5">{thread.lastMessage}</p>
        {thread.unread && (
          <div className="flex items-center gap-1 mt-1">
            <Circle className="h-2 w-2 fill-primary text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">New</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] px-4 py-2.5 ${
        isOwn
          ? 'bg-primary text-primary-foreground'
          : 'bg-card border border-border text-foreground'
      }`}>
        <p className="text-[13px] leading-relaxed">{msg.content}</p>
        <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {fmtTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function MessagesPage() {
  const { user, login, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [selectedThread, setSelectedThread] = useState<ThreadPreview | null>(null);
  const [messageText, setMessageText] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all messages involving the current user
  const { data: allMessages, isLoading: msgLoading } = useQuery({
    queryKey: ['messages', user?.id],
    queryFn: async () => {
      if (!user) return [] as Message[];
      const localMessages = JSON.parse(localStorage.getItem('kerodex-messages') || '[]') as Message[];
      const conversations = await listConversations();
      const conversationMessages = conversations.flatMap((conversation) => {
        if (conversation.messages?.length) return conversation.messages;
        const partnerId = conversation.buyerId === user.id
          ? conversation.sellerId || 'seller'
          : conversation.buyerId || 'buyer';
        return [{
          id: `${conversation.id}_seed`,
          senderId: partnerId,
          receiverId: user.id,
          vehicleId: conversation.listingId,
          content: conversation.lastMessage,
          createdAt: conversation.updatedAt,
        }];
      });
      const all = [...conversationMessages, ...localMessages] as Message[];
      all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return all;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  // Build thread list from messages
  const threads: ThreadPreview[] = (() => {
    if (!allMessages || !user) return [];
    const seen = new Map<string, ThreadPreview>();
    for (const msg of allMessages) {
      const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
      const key = `${partnerId}__${msg.vehicleId}`;
      seen.set(key, {
        partnerId: partnerId ?? '',
        vehicleId: msg.vehicleId ?? '',
        lastMessage: msg.content ?? '',
        lastAt: msg.createdAt ?? '',
        unread: msg.receiverId === user.id,
        vehicleTitle: `Vehicle #${(msg.vehicleId ?? '').substring(0, 6)}`,
      });
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );
  })();

  // Messages in selected thread
  const threadMessages = allMessages?.filter((m) => {
    if (!selectedThread || !user) return false;
    const involved =
      (m.senderId === user.id && m.receiverId === selectedThread.partnerId) ||
      (m.receiverId === user.id && m.senderId === selectedThread.partnerId);
    return involved && m.vehicleId === selectedThread.vehicleId;
  }) ?? [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !selectedThread) return;
      const nextMessage = {
        id: `msg_${Date.now()}`,
        senderId: user.id,
        receiverId: selectedThread.partnerId,
        vehicleId: selectedThread.vehicleId,
        content,
        createdAt: new Date().toISOString(),
      };
      const current = JSON.parse(localStorage.getItem('kerodex-messages') || '[]') as Message[];
      localStorage.setItem('kerodex-messages', JSON.stringify([...current, nextMessage]));
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['messages', user?.id] });
    },
    onError: () => toast.error('Failed to send message.'),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text) return;
    sendMutation.mutate(text);
  };

  const handleSelectThread = (thread: ThreadPreview) => {
    setSelectedThread(thread);
    setMobileView('thread');
  };

  const filteredThreads = threads.filter((t) =>
    !search || t.vehicleTitle.toLowerCase().includes(search.toLowerCase())
  );

  // ── Loading / Auth States ────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-6" />
        <h2 className="text-xl font-bold mb-2">Your Messages</h2>
        <p className="text-muted-foreground text-[13px] mb-8 max-w-xs">
          Sign in to view and send messages to buyers and sellers.
        </p>
        <Button onClick={login} className="h-10 px-8 text-[12px] font-bold uppercase tracking-widest">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{ height: 'calc(100vh - 3.5rem)' }}
    >
      <div className="flex h-full">
        {/* ── Thread List (sidebar) ──────────────────────────────────── */}
        <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-border bg-background shrink-0 ${
          mobileView === 'thread' ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header */}
          <div className="px-4 py-4 border-b border-border shrink-0">
            <h1 className="text-[16px] font-black tracking-tight mb-3">Messages</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-[12px] border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {msgLoading ? (
              <div className="space-y-px">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3 p-4 border-b border-border">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-3/4 bg-muted animate-pulse" />
                      <div className="h-3 w-1/2 bg-muted animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-4" />
                <p className="text-[13px] text-muted-foreground font-medium">No conversations yet</p>
                <p className="text-[12px] text-muted-foreground/70 mt-1">
                  Message a seller from any vehicle listing.
                </p>
                <Link to="/search" className="mt-4">
                  <Button variant="outline" className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                    <Car className="h-3.5 w-3.5 mr-2" />
                    Browse Listings
                  </Button>
                </Link>
              </div>
            ) : (
              filteredThreads.map((t) => (
                <ThreadItem
                  key={`${t.partnerId}__${t.vehicleId}`}
                  thread={t}
                  selected={selectedThread?.partnerId === t.partnerId && selectedThread?.vehicleId === t.vehicleId}
                  onSelect={() => handleSelectThread(t)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Thread / Conversation ─────────────────────────────────── */}
        <div className={`flex-1 flex flex-col bg-background min-w-0 ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}>
          {!selectedThread ? (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-[15px] font-bold text-muted-foreground mb-1">Select a conversation</p>
              <p className="text-[12px] text-muted-foreground/70 max-w-xs">
                Choose a thread from the left to read and reply to messages.
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
                <button
                  onClick={() => setMobileView('list')}
                  className="md:hidden h-9 w-9 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[12px] shrink-0">
                  {selectedThread.partnerId.substring(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">
                    {selectedThread.vehicleTitle}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    ID: {selectedThread.partnerId.substring(0, 8)}…
                  </div>
                </div>

                {selectedThread.vehicleId && (
                  <Link to="/vehicle/$id" params={{ id: selectedThread.vehicleId }}>
                    <Button variant="outline" className="h-8 px-3 text-[11px] font-bold uppercase tracking-wider hidden sm:flex">
                      <Car className="h-3.5 w-3.5 mr-1.5" />
                      View Car
                    </Button>
                  </Link>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {threadMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <User className="h-8 w-8 text-muted-foreground/40 mb-3" />
                    <p className="text-[13px] text-muted-foreground">
                      No messages yet. Say hello!
                    </p>
                  </div>
                ) : (
                  threadMessages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isOwn={msg.senderId === user.id}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <form
                onSubmit={handleSend}
                className="flex items-center gap-2 p-3 border-t border-border shrink-0"
              >
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 h-10 px-4 text-[13px] border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  disabled={!messageText.trim() || sendMutation.isPending}
                  className="h-10 w-10 p-0 flex items-center justify-center shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
