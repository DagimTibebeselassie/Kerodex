import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { ConversationRecord, createReport, listConversations, markConversationRead, markSafetyNoticeSeen, sendConversationMessage } from '@/lib/api';
import { Button, Input, toast } from '@blinkdotnew/ui';
import {
  MessageSquare, Send, Car, ArrowLeft, Search, User, Circle, AlertTriangle, Flag, X,
} from 'lucide-react';
import { Message } from '@/types';

interface ThreadPreview {
  conversationId: string;
  partnerId: string;
  partnerName: string;
  partnerLastActiveAt?: string;
  vehicleId: string;
  lastMessage: string;
  lastAt: string;
  unread: boolean;
  vehicleTitle: string;
  messages: Message[];
  scamRiskScore?: number;
  scamFlags?: string[];
  moderationStatus?: 'clear' | 'needs_review' | 'high_risk';
}

const SAFETY_NOTICE_TEXT = 'Safety reminder: Meet in a public, well-lit place. Bring another person if possible. Do not send deposits or payments before verifying the vehicle and documents in person. Verify the title, VIN, seller identity, and vehicle condition before completing a purchase. If anything feels suspicious, stop the conversation and report the user.';

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'K';
}

function presence(iso?: string) {
  if (!iso) return { label: 'Activity unknown', color: 'bg-muted-foreground/40' };
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 2 * 60 * 1000) return { label: 'Active now', color: 'bg-emerald-500' };
  if (diff < 24 * 60 * 60 * 1000) return { label: `Active ${fmtTime(iso)}`, color: 'bg-amber-400' };
  return { label: `Last active ${fmtTime(iso)}`, color: 'bg-muted-foreground/50' };
}

function ThreadItem({
  thread,
  selected,
  onSelect,
}: {
  thread: ThreadPreview;
  selected: boolean;
  onSelect: () => void;
}) {
  const initials = initialsFor(thread.partnerName);
  const status = presence(thread.partnerLastActiveAt);

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
          <span className="text-[13px] font-bold truncate">{thread.partnerName || 'Kerodex member'}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(thread.lastAt)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{thread.vehicleTitle || 'Vehicle Inquiry'}</p>
        <p className="text-[12px] text-muted-foreground truncate mt-0.5">{thread.lastMessage}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`h-1.5 w-1.5 rounded-full ${status.color}`} />
          <span className="text-[10px] text-muted-foreground">{status.label}</span>
        </div>
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

export function MessagesPage() {
  const { user, login, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [selectedThread, setSelectedThread] = useState<ThreadPreview | null>(null);
  const [messageText, setMessageText] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [search, setSearch] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [safetyDismissed, setSafetyDismissed] = useState(Boolean(user?.safetyNoticeSeenAt || localStorage.getItem('kerodex_safety_notice_seen')));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch server-backed conversations. Polling keeps two open browsers in sync for MVP.
  const { data: conversations = [], isLoading: msgLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [] as ConversationRecord[];
      return listConversations();
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const existing = query.state.data as ConversationRecord[] | undefined;
      return existing && existing.length > 0 ? 2000 : false;
    },
    refetchOnWindowFocus: false,
  });

  const threads: ThreadPreview[] = conversations.map((conversation) => ({
    conversationId: conversation.id,
    partnerId: conversation.partnerId || (conversation.buyerId === user?.id ? conversation.sellerId : conversation.buyerId) || '',
    partnerName: conversation.partnerName || (conversation.buyerId === user?.id ? conversation.sellerName : conversation.buyerName) || 'Kerodex member',
    partnerLastActiveAt: conversation.partnerLastActiveAt,
    vehicleId: conversation.listingId,
    lastMessage: conversation.lastMessage || '',
    lastAt: conversation.updatedAt,
    unread: Number(conversation.unread || 0) > 0,
    vehicleTitle: conversation.vehicleTitle || 'Vehicle Inquiry',
    scamRiskScore: conversation.scamRiskScore,
    scamFlags: conversation.scamFlags,
    moderationStatus: conversation.moderationStatus,
    messages: (conversation.messages || []).slice().sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ) as Message[],
  })).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );

  useEffect(() => {
    if (!selectedThread) return;
    const fresh = threads.find((thread) => thread.conversationId === selectedThread.conversationId);
    if (fresh && fresh.lastAt !== selectedThread.lastAt) setSelectedThread(fresh);
  }, [threads, selectedThread]);

  const threadMessages = selectedThread?.messages ?? [];

  useEffect(() => {
    if (!selectedThread?.conversationId || !selectedThread.unread || !user) return;
    let cancelled = false;
    markConversationRead(selectedThread.conversationId)
      .then((conversation) => {
        if (cancelled) return;
        queryClient.setQueryData<ConversationRecord[]>(['conversations', user.id], (current = []) =>
          current.map((item) => item.id === conversation.id ? conversation : item)
        );
        queryClient.invalidateQueries({ queryKey: ['nav-unread-conversations', user.id] });
      })
      .catch(() => {
        // A read receipt should not interrupt the conversation view.
      });
    return () => { cancelled = true; };
  }, [queryClient, selectedThread?.conversationId, selectedThread?.unread, user]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !selectedThread) return;
      return sendConversationMessage(selectedThread.conversationId, content);
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.id] });
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

  const handleSafetyDismiss = async () => {
    setSafetyDismissed(true);
    localStorage.setItem('kerodex_safety_notice_seen', new Date().toISOString());
    try {
      await markSafetyNoticeSeen();
    } catch {
      // Keep the local dismissal so the notice does not nag during a temporary network issue.
    }
  };

  const reportMutation = useMutation({
    mutationFn: async (description: string) => {
      if (!selectedThread) return;
      return createReport({
        reportedUserId: selectedThread.partnerId,
        listingId: selectedThread.vehicleId,
        conversationId: selectedThread.conversationId,
        category: 'suspected_scam',
        description,
      });
    },
    onSuccess: () => {
      toast.success('Report submitted for Kerodex review.');
      setReportOpen(false);
      setReportText('');
    },
    onError: (error: any) => toast.error(error?.message || 'Unable to submit report.'),
  });

  const handleReportThread = async () => {
    if (!selectedThread) return;
    setReportOpen(true);
  };

  const handleSubmitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    const description = reportText.trim();
    if (!description) return;
    try {
      await reportMutation.mutateAsync(description);
    } catch { /* handled by mutation */ }
  };

  const filteredThreads = threads.filter((t) =>
    !search ||
    t.vehicleTitle.toLowerCase().includes(search.toLowerCase()) ||
    t.partnerName.toLowerCase().includes(search.toLowerCase())
  );

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
      {reportOpen && selectedThread && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-md border border-border bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-[14px] font-black tracking-tight">Report conversation</h2>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Kerodex will review this thread for safety concerns.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Close report dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="text-[12px] text-muted-foreground">
                Reporting <span className="text-foreground font-semibold">{selectedThread.partnerName}</span> about{' '}
                <span className="text-foreground font-semibold">{selectedThread.vehicleTitle}</span>.
              </div>
              <textarea
                value={reportText}
                onChange={(event) => setReportText(event.target.value)}
                rows={5}
                autoFocus
                placeholder="Describe what feels suspicious, unsafe, or inaccurate..."
                className="w-full resize-none border border-border bg-background px-3 py-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReportOpen(false)}
                className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!reportText.trim() || reportMutation.isPending}
                className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider"
              >
                Submit Report
              </Button>
            </div>
          </form>
        </div>
      )}
      <div className="flex h-full">
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
                placeholder="Search conversations..."
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
                  key={t.conversationId}
                  thread={t}
                  selected={selectedThread?.conversationId === t.conversationId}
                  onSelect={() => handleSelectThread(t)}
                />
              ))
            )}
          </div>
        </div>

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
                  {initialsFor(selectedThread.partnerName)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">
                    {selectedThread.partnerName}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${presence(selectedThread.partnerLastActiveAt).color}`} />
                    <span>{presence(selectedThread.partnerLastActiveAt).label}</span>
                    <span className="text-muted-foreground/50">/</span>
                    <span className="truncate">{selectedThread.vehicleTitle}</span>
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
                <Button
                  variant="outline"
                  onClick={handleReportThread}
                  className="h-8 px-3 text-[11px] font-bold uppercase tracking-wider"
                >
                  <Flag className="h-3.5 w-3.5 mr-1.5" />
                  Report
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {!safetyDismissed && (
                  <div className="border border-amber-400/30 bg-amber-400/10 p-3 text-[12px] leading-relaxed text-foreground flex gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="flex-1">{SAFETY_NOTICE_TEXT}</p>
                    <button onClick={handleSafetyDismiss} className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Dismiss safety reminder">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {(selectedThread.moderationStatus === 'needs_review' || selectedThread.moderationStatus === 'high_risk') && (
                  <div className="border border-border bg-muted/40 p-3 text-[12px] leading-relaxed text-muted-foreground flex gap-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                      Kerodex detected language that may require extra caution. Review the vehicle, title, VIN, and payment details in person before moving forward.
                    </p>
                  </div>
                )}
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
                  placeholder="Type a message..."
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
