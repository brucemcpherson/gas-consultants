import React, { useState, useEffect } from "react";
import { X, Mail, MailOpen, Trash2, ChevronRight, Inbox, AlertCircle, Clock, Send } from "lucide-react";
import { DirectMessage } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, updateDoc, deleteDoc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { User } from "firebase/auth";
import { ThemeColors } from "../lib/theme";

interface MyInboxModalProps {
  currentUser: User;
  onClose: () => void;
  activeTheme: ThemeColors;
}

export default function MyInboxModal({ currentUser, onClose, activeTheme }: MyInboxModalProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<DirectMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );

  const handleRequestPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const res = await Notification.requestPermission();
        setNotificationPermission(res);
      } catch (err) {
        console.warn("Failed to request notification permission:", err);
      }
    }
  };

  // Load user-specific messages in real-time (dual query: uid and email to be fully robust, sorted client-side to prevent composite index errors)
  useEffect(() => {
    setIsLoading(true);
    let messagesByUid: DirectMessage[] = [];
    let messagesByEmail: DirectMessage[] = [];

    const updateCombined = () => {
      const mergedMap = new Map<string, DirectMessage>();
      messagesByUid.forEach((m) => mergedMap.set(m.id, m));
      messagesByEmail.forEach((m) => mergedMap.set(m.id, m));
      const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      setMessages(mergedList);
      setIsLoading(false);
    };

    // 1. Query by UID
    const q1 = query(
      collection(db, "messages"),
      where("contributorUserId", "==", currentUser.uid)
    );
    const unsubscribe1 = onSnapshot(
      q1,
      (snapshot) => {
        messagesByUid = [];
        snapshot.forEach((docSnap) => {
          messagesByUid.push({ id: docSnap.id, ...docSnap.data() } as DirectMessage);
        });
        updateCombined();
      },
      (error) => {
        console.error("Failed to load user inbox messages by UID:", error);
        setErrorMessage("Could not load your messages. Please try again later.");
        setIsLoading(false);
      }
    );

    // 2. Query by email
    const q2 = query(
      collection(db, "messages"),
      where("contributorEmail", "==", currentUser.email)
    );
    const unsubscribe2 = onSnapshot(
      q2,
      (snapshot) => {
        messagesByEmail = [];
        snapshot.forEach((docSnap) => {
          messagesByEmail.push({ id: docSnap.id, ...docSnap.data() } as DirectMessage);
        });
        updateCombined();
      },
      (error) => {
        console.error("Failed to load user inbox messages by email:", error);
      }
    );

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [currentUser]);

  // Handle marking message as read/unread
  const handleToggleRead = async (msg: DirectMessage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const docRef = doc(db, "messages", msg.id);
      await updateDoc(docRef, { read: !msg.read });
      // Update selected message state if currently viewed
      if (selectedMessage && selectedMessage.id === msg.id) {
        setSelectedMessage({ ...selectedMessage, read: !msg.read });
      }
    } catch (err: any) {
      console.error("Failed to update message read state:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `messages/${msg.id}`);
      } catch (formattedErr: any) {
        setErrorMessage("Action Denied: Could not update message status.");
      }
    }
  };

  // Handle viewing a message (and auto-marking as read if unread)
  const handleSelectMessage = async (msg: DirectMessage) => {
    setSelectedMessage(msg);
    if (!msg.read) {
      try {
        const docRef = doc(db, "messages", msg.id);
        await updateDoc(docRef, { read: true });
      } catch (err) {
        console.error("Failed to auto-mark message as read:", err);
      }
    }
  };

  // Handle message deletion
  const handleDeleteMessage = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to permanently delete this message?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "messages", msgId));
      if (selectedMessage && selectedMessage.id === msgId) {
        setSelectedMessage(null);
      }
    } catch (err: any) {
      console.error("Failed to delete message:", err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `messages/${msgId}`);
      } catch (formattedErr: any) {
        setErrorMessage("Action Denied: Could not delete message from your inbox.");
      }
    }
  };

  // Helper to format timestamps gracefully
  const formatTimestamp = (createdAt: any) => {
    if (!createdAt) return "Just now";
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activeBorderClass = 
    activeTheme.id === "emerald" ? "border-emerald-600" :
    activeTheme.id === "royal" ? "border-blue-600" :
    activeTheme.id === "terracotta" ? "border-amber-600" :
    activeTheme.id === "orange" ? "border-orange-600" :
    "border-slate-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl h-[80vh] flex flex-col rounded-2xl bg-white dark:bg-slate-905 shadow-2xl transition-all overflow-hidden border border-slate-100 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-950/40 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-sans text-lg font-bold text-slate-900 dark:text-white">My Inbox</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You have {messages.filter(m => !m.read).length} unread contact inquiries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* Real-time HTML5 Notifications Requester */}
            {typeof window !== "undefined" && "Notification" in window && (
              <>
                {notificationPermission === "default" && (
                  <button
                    onClick={handleRequestPermission}
                    className="text-[10px] bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Enable system desktop push alert banners when new messages arrive"
                  >
                    <span>🔔 Enable Desktop Alerts</span>
                  </button>
                )}
                {notificationPermission === "granted" && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 px-2.5 py-1 rounded-lg font-sans font-extrabold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Desktop Alerts Active</span>
                  </span>
                )}
                {notificationPermission === "denied" && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 px-2.5 py-1 rounded-lg font-sans font-semibold flex items-center gap-1">
                    <span>Alerts Blocked by Browser</span>
                  </span>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex min-h-0 divide-x divide-slate-100 dark:divide-slate-800">
          
          {/* Left Column: Messages List */}
          <div className={`${selectedMessage ? "hidden md:flex" : "flex"} w-full md:w-2/5 flex-col min-h-0 bg-slate-50/25 dark:bg-slate-950/10`}>
            
            {errorMessage && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs flex items-center gap-2 border-b border-red-100 dark:border-red-900/40">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}
 
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 min-h-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className={`h-8 w-8 animate-spin rounded-full border-2 border-slate-200 dark:border-slate-850 border-t-current ${activeTheme.primaryText}`}></div>
                  <p className="mt-3 text-xs text-slate-400">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                  <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-355 dark:text-slate-600 mb-3">
                    <Inbox className="h-10 w-10 stroke-[1.5]" />
                  </div>
                  <p className="font-sans text-sm font-semibold text-slate-800 dark:text-slate-200">Your Inbox is Empty</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                    When someone submits the contact form on your public contributor card, it will show up here.
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`group relative p-5 flex flex-col gap-2 cursor-pointer transition-all ${
                        isSelected 
                          ? `${activeTheme.primaryBgLight} dark:bg-slate-900 border-l-4 ${activeBorderClass}` 
                          : "bg-white dark:bg-slate-905 hover:bg-slate-50/75 dark:hover:bg-slate-900/40 border-l-4 border-l-transparent"
                      }`}
                    >
                      {/* Top row: sender & date */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs sm:text-sm font-bold truncate max-w-[130px] ${!msg.read ? "text-slate-900 dark:text-white" : "text-slate-550 dark:text-slate-400"}`}>
                          {msg.senderName}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0 opacity-60" />
                          {formatTimestamp(msg.createdAt)}
                        </span>
                      </div>
 
                      {/* Subject */}
                      <span className={`text-xs sm:text-sm font-semibold truncate ${!msg.read ? "text-slate-900 dark:text-white font-extrabold" : "text-slate-650 dark:text-slate-300"}`}>
                        {msg.subject}
                      </span>
 
                      {/* Body excerpt */}
                      <p className="text-xs text-slate-450 dark:text-slate-400 line-clamp-3 mt-1 leading-relaxed break-words">
                        {msg.message}
                      </p>
 
                      {/* Quick action buttons on hover */}
                      <div className="absolute right-3 bottom-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleToggleRead(msg, e)}
                          title={msg.read ? "Mark as Unread" : "Mark as Read"}
                          className="p-1.5 rounded-md bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
                        >
                          {msg.read ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={(e) => handleDeleteMessage(msg.id, e)}
                          title="Delete Message"
                          className="p-1.5 rounded-md bg-white dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
 
                      {/* Blue unread dot indicator */}
                      {!msg.read && (
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
 
          {/* Right Column: Message Detail View */}
          <div className={`${selectedMessage ? "flex" : "hidden md:flex"} flex-1 flex-col min-h-0 bg-white dark:bg-slate-905`}>
            {selectedMessage ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Detail Header */}
                <div className="border-b border-slate-100 dark:border-slate-800 p-6 bg-slate-50/15 dark:bg-slate-950/20">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Back button on mobile */}
                      <button
                        onClick={() => setSelectedMessage(null)}
                        className="md:hidden mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-550 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                        <span>Back to Inbox</span>
                      </button>
                      <h4 className="font-sans text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug break-words">
                        {selectedMessage.subject}
                      </h4>
                      <div className="flex flex-col gap-1 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-slate-705 dark:text-slate-300">{selectedMessage.senderName}</span>
                          <span className="truncate">&lt;{selectedMessage.senderEmail}&gt;</span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3 stroke-[1.75]" />
                          Received on {formatTimestamp(selectedMessage.createdAt)}
                        </div>
                      </div>
                    </div>
 
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => handleToggleRead(selectedMessage, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        {selectedMessage.read ? (
                          <>
                            <Mail className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Mark Unread</span>
                          </>
                        ) : (
                          <>
                            <MailOpen className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Mark Read</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(selectedMessage.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 hover:border-red-105 transition text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
 
                {/* Detail Body */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200 text-sm sm:text-base font-sans selection:bg-blue-105 select-text">
                  {selectedMessage.message}
                </div>
 
                {/* Detail Footer: Quick Reply */}
                <div className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50/25 dark:bg-slate-950/20 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    Need to respond? Direct emails go to <span className="font-semibold text-slate-600 dark:text-slate-300">{selectedMessage.senderEmail}</span>
                  </span>
                  <a
                    href={`mailto:${selectedMessage.senderEmail}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-105 rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Reply</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-450 dark:text-slate-500">
                <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-700 mb-2">
                  <Mail className="h-8 w-8 stroke-[1.5]" />
                </div>
                <h4 className="font-sans text-sm font-semibold text-slate-600 dark:text-slate-300">No Message Selected</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mt-1">
                  Choose an inquiry from the left panel to inspect the full contents, sender information, and reply directly.
                </p>
              </div>
            )}
          </div>
 
        </div>

      </div>
    </div>
  );
}
