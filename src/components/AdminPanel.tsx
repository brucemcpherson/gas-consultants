import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { 
  CheckCircle2, 
  Trash2, 
  Mail, 
  MailOpen,
  ChevronRight,
  UserCheck, 
  AlertTriangle,
  FolderOpen,
  MessageSquare,
  Sparkles,
  Eye,
  EyeOff,
  Flag,
  Unlock
} from "lucide-react";
import { Contributor, DirectMessage } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  onSnapshot
} from "firebase/firestore";

interface AdminPanelProps {
  user: User | null;
  contributors: Contributor[];
  onRefreshContributors: () => void;
}

export default function AdminPanel({
  user,
  contributors,
  onRefreshContributors,
}: AdminPanelProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  // Toggle Message read state in Firestore
  const handleToggleRead = async (m: DirectMessage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const docRef = doc(db, "messages", m.id);
      await updateDoc(docRef, { read: !m.read });
    } catch (err) {
      console.error("Failed to toggle admin message read state:", err);
      showFeedback("Failed to update message status.", "error");
    }
  };

  // Filter pending profiles (defensively, any profile that is not explicitly approved is considered pending/needs-attention)
  const pendingContributors = contributors.filter((c) => c.status !== "approved");
  const approvedContributors = contributors.filter((c) => c.status === "approved");

  // Synchronize or backfill systemRole explicitly into all database documents
  const handleSyncSystemRoles = async () => {
    if (!window.confirm("This will write the 'systemRole' field into all existing contributor documents in Firestore to ensure schema integrity. Proceed?")) return;

    setIsSyncing(true);
    let count = 0;
    try {
      for (const c of contributors) {
        const docRef = doc(db, "contributors", c.id);
        const determinedRole = c.systemRole || (c.email?.toLowerCase() === "bruce@mcpher.com" ? "admin" : "contributor");
        await updateDoc(docRef, {
          systemRole: determinedRole
        });
        count++;
      }
      onRefreshContributors();
      showFeedback(`Successfully updated and synchronized systemRole for ${count} contributors in the database!`);
    } catch (err: any) {
      console.error("Failed to sync system roles:", err);
      showFeedback(`Sync failed: ${err.message || err}`, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // Load received contact-form messages for administrative auditing
  useEffect(() => {
    setIsLoadingMessages(true);
    const q = collection(db, "messages");
    
    // Admins can do a full snapshot listen
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgsList: DirectMessage[] = [];
      snapshot.forEach((doc) => {
        msgsList.push({ id: doc.id, ...doc.data() } as DirectMessage);
      });
      // Sort in descending order
      msgsList.sort((a,b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      setMessages(msgsList);
      setIsLoadingMessages(false);
    }, (error) => {
      console.error("Failed to fetch administrative audits messages list:", error);
      setIsLoadingMessages(false);
    });

    return () => unsubscribe();
  }, []);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setActionMessage({ type, text });
    setTimeout(() => {
      setActionMessage(null);
    }, 4000);
  };

  // Approve Profile
  const handleApprove = async (id: string) => {
    if (!window.confirm("Are you sure you want to approve this contributor profile?")) return;

    try {
      const docRef = doc(db, "contributors", id);
      await updateDoc(docRef, { status: "approved" });
      onRefreshContributors();
      showFeedback("Contributor profile approved!");
    } catch (err) {
      console.error("Approval err:", err);
      showFeedback("Failed to approve contributor profile", "error");
    }
  };

  // Delete Profile
  const handleDeleteContributor = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the profile for ${name}?`)) return;

    try {
      await deleteDoc(doc(db, "contributors", id));
      onRefreshContributors();
      showFeedback(`Profile for ${name} has been deleted.`);
    } catch (err: any) {
      console.error("Delete err:", err);
      let errorMsg = "Action Denied: Insufficient permissions to delete this profile.";
      try {
        handleFirestoreError(err, OperationType.DELETE, `contributors/${id}`);
      } catch (formattedErr: any) {
        if (err?.message) {
          errorMsg = `Failed to delete profile: ${err.message}`;
        }
      }
      showFeedback(errorMsg, "error");
    }
  };

  // Toggle Hidden Status
  const handleToggleHideContributor = async (id: string, currentlyHidden: boolean) => {
    try {
      const docRef = doc(db, "contributors", id);
      await updateDoc(docRef, { hidden: !currentlyHidden });
      onRefreshContributors();
      showFeedback(`Profile visibility updated successfully!`);
    } catch (err: any) {
      console.error("Toggle hide error:", err);
      showFeedback(`Failed to update visibility: ${err.message || err}`, "error");
    }
  };

  // Unclaim a profile (remove userId link)
  const handleUnclaimContributor = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove the 'claimed' flag and unlink the Google Account associated with "${name}"?`)) return;

    try {
      const docRef = doc(db, "contributors", id);
      await updateDoc(docRef, { userId: null });
      onRefreshContributors();
      showFeedback(`Successfully unlinked Google Account for "${name}".`);
    } catch (err: any) {
      console.error("Unclaim error:", err);
      showFeedback(`Failed to unlink profile: ${err.message || err}`, "error");
    }
  };

  // Delete Message audit logging
  const handleDeleteMessage = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;

    try {
      await deleteDoc(doc(db, "messages", id));
      showFeedback("Message deleted successfully.");
    } catch (err) {
      console.error("Delete message err:", err);
      showFeedback("Failed to delete message.", "error");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-150 pb-4 gap-4">
        <div>
          <h2 className="font-sans text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 animate-pulse" />
            Directory Admin Operations
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Approve incoming claims, manage profiles, and monitor system-wide logs.</p>
        </div>
        <button
          onClick={handleSyncSystemRoles}
          disabled={isSyncing}
          className="px-3.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:from-blue-700 hover:to-indigo-700 transition duration-150 active:scale-95 disabled:opacity-55 flex items-center gap-1.5 self-start sm:self-center"
        >
          {isSyncing ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
              Syncing roles...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Sync systemRole in DB
            </>
          )}
        </button>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-xl text-xs sm:text-sm font-semibold border ${
          actionMessage.type === "success" 
            ? "bg-green-50 text-green-700 border-green-100" 
            : "bg-red-50 text-red-700 border-red-100"
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* Grid section split into profiles approvals & messages logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Approvals Section */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-inner">
            <h3 className="font-sans font-bold text-gray-800 text-sm mb-4 flex items-center gap-1.5">
              <UserCheck className="h-4.5 w-4.5 text-amber-500" />
              Pending Approvals ({pendingContributors.length})
            </h3>

            {pendingContributors.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-gray-150 rounded-xl">
                <p className="text-xs text-gray-400">All contributor profiles are currently verified.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {pendingContributors.map((c) => (
                  <div key={c.id} className="p-4 border border-slate-150 bg-amber-50/20 rounded-xl relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">{c.name}</h4>
                        <p className="text-xs font-bold text-amber-700">
                          {c.role} {c.company ? `(${c.company})` : ""}
                        </p>
                        <p className="text-[10.5px] text-slate-500 mt-1">{c.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(c.id)}
                          title="Approve Profile"
                          className="p-1 px-2.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeleteContributor(c.id, c.name)}
                          title="Delete profile"
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100/30 text-xs text-slate-600 italic">
                      <span className="font-bold not-italic text-slate-500 mr-1">Bio:</span> "{c.bio}"
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active lists */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm">
            <h3 className="font-sans font-bold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
              <FolderOpen className="h-4.5 w-4.5 text-blue-500" />
              Manage Active Directory ({approvedContributors.length})
            </h3>

            <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100 pr-2">
              {approvedContributors.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">The directory contains no approved entries.</p>
              ) : (
                approvedContributors.map((c) => (
                  <div key={c.id} className="flex justify-between items-center py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-slate-900 text-xs sm:text-sm flex flex-wrap items-center gap-1.5 leading-snug">
                        <span>{c.name}</span>
                        {c.userId && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-blue-50 text-blue-700 rounded font-bold border border-blue-100">
                            Claimed
                          </span>
                        )}
                        {c.hidden && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-slate-100 text-slate-600 rounded font-bold border border-slate-200">
                            Hidden
                          </span>
                        )}
                        {c.flagged && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-red-50 text-red-700 rounded font-bold border border-red-100 flex items-center gap-0.5">
                            <Flag className="h-2 w-2 text-red-500 fill-red-500 animate-pulse" />
                            Reported {c.flagCount && c.flagCount > 1 ? `(${c.flagCount})` : ""}
                          </span>
                        )}
                      </h4>
                      <p className="text-[10.5px] text-slate-400 truncate">
                        {c.role} {c.company ? `(${c.company})` : ""} • {c.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Unclaim Toggle */}
                      {c.userId && (
                        <button
                          onClick={() => handleUnclaimContributor(c.id, c.name)}
                          title="Unclaim profile (unlink Google account)"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-50 rounded-xl transition"
                        >
                          <Unlock className="h-4.5 w-4.5" />
                        </button>
                      )}

                      {/* Hide / Unhide Toggle */}
                      <button
                        onClick={() => handleToggleHideContributor(c.id, c.hidden || false)}
                        title={c.hidden ? "Unhide profile (make public)" : "Hide profile from public list"}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition"
                      >
                        {c.hidden ? (
                          <Eye className="h-4.5 w-4.5 text-blue-650" />
                        ) : (
                          <EyeOff className="h-4.5 w-4.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteContributor(c.id, c.name)}
                        title="Permanently remove profile"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Messaging Inboxes System logs */}
        <section className="lg:col-span-5">
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm h-full flex flex-col justify-between">
            <div>
              <h3 className="font-sans font-bold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
                <Mail className="h-4.5 w-4.5 text-sky-500" />
                Contact Inquiries Log ({messages.length})
              </h3>

              {isLoadingMessages ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600/30 border-t-blue-600"></div>
                  <span className="text-xs text-slate-400">Loading inbox...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-400">No contact messages logged yet.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 select-none">
                  {messages.map((m) => {
                    const isExpanded = expandedMessageId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setExpandedMessageId(isExpanded ? null : m.id);
                          // Auto-mark as read when expanding
                          if (!m.read && !isExpanded) {
                            handleToggleRead(m);
                          }
                        }}
                        className={`p-3.5 rounded-xl border transition cursor-pointer text-xs ${
                          isExpanded 
                            ? "bg-slate-50 border-slate-300 shadow-xs" 
                            : !m.read 
                              ? "bg-blue-50/25 border-blue-200 hover:border-blue-300" 
                              : "bg-slate-50/10 border-slate-150 hover:border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {!m.read && (
                                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse shrink-0" title="Unread Inquiry" />
                              )}
                              <span className="font-bold text-slate-800 text-[11px] truncate">
                                {m.senderName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-medium text-slate-400 w-10 shrink-0">From:</span>
                              <span className="text-slate-600 font-mono break-all">{m.senderEmail}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-medium text-slate-400 w-10 shrink-0">To:</span>
                              <span className="text-slate-600 font-mono break-all">
                                {m.contributorEmail || `ID: ${m.contributorId}`}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 pt-0.5">
                              Logged: {m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleString() : "Present"}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Mark as read toggle */}
                            <button
                              onClick={() => handleToggleRead(m)}
                              title={m.read ? "Mark as unread" : "Mark as read"}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition"
                            >
                              {m.read ? <MailOpen className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5 text-blue-600" />}
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(m.id)}
                              title="Delete log entry"
                              className="text-slate-400 hover:text-red-500 p-1.5 rounded-md transition hover:bg-slate-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-slate-700 animate-fade-in">
                            <div className="bg-white p-2.5 rounded-lg border border-slate-150">
                              <span className="font-bold text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Subject</span>
                              <span className="text-[11px] font-semibold text-slate-800 block leading-snug">{m.subject}</span>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-slate-150">
                              <span className="font-bold text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">Message Content</span>
                              <p className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 p-3 flex items-start gap-2 bg-blue-50/30 rounded-xl border border-blue-50 text-[11px] text-slate-500">
              <AlertTriangle className="h-4.5 w-4.5 text-blue-505 shrink-0 mt-0.5" />
              <span>Administrative auditing is restricted to verified administrators and provides absolute log integrity.</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
