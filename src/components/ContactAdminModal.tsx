import React, { useState } from "react";
import { X, Send, CheckCircle2, AlertTriangle, Shield, Mail } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ThemeColors } from "../lib/theme";
import { User } from "firebase/auth";

interface ContactAdminModalProps {
  currentUser: User | null;
  onClose: () => void;
  activeTheme: ThemeColors;
}

export default function ContactAdminModal({ currentUser, onClose, activeTheme }: ContactAdminModalProps) {
  const [senderName, setSenderName] = useState(currentUser?.displayName || "");
  const [senderEmail, setSenderEmail] = useState(currentUser?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !senderEmail.trim() || !subject.trim() || !message.trim()) {
      setErrorMessage("Please fill in all details.");
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    const messageId = "msg_admin_" + Math.random().toString(36).substring(2, 15);
    const path = `messages/${messageId}`;

    try {
      // Build admin messaging payload
      const messagePayload = {
        id: messageId,
        contributorId: "admin",
        contributorEmail: "bruce@mcpher.com",
        contributorUserId: "admin", // Recipient flag for administrators
        senderName: senderName.trim(),
        senderEmail: senderEmail.trim(),
        subject: subject.trim(),
        message: message.trim(),
        read: false,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "messages", messageId), messagePayload);
      
      // Also open device's native email application
      const mailtoUrl = `mailto:bruce@mcpher.com?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(message.trim())}`;
      window.location.href = mailtoUrl;

      setIsSuccess(true);
    } catch (err) {
      console.error("Failed to message administrator:", err);
      try {
        handleFirestoreError(err, OperationType.CREATE, path);
      } catch (formattedErr: any) {
        setErrorMessage("Action Denied: Could not deliver message to the administrator database.");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Shield className={`h-5 w-5 ${activeTheme.primaryText}`} />
            <div>
              <h3 className="font-sans text-base sm:text-lg font-bold text-slate-900">Message Administrator</h3>
              <p className="text-[11px] text-slate-500">Send an official feedback or support inquiry to Bruce Mcpher</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-500 shadow-inner mb-4 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="font-sans text-base font-bold text-slate-900">Message Sent Successfully!</h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed">
              Your inquiry has been securely routed to Bruce. He will review and respond to your registered email address.
            </p>
            <button
              onClick={onClose}
              className={`mt-6 w-full rounded-xl ${activeTheme.primaryBg} py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md ${activeTheme.primaryHoverBg} transition`}
            >
              Back to Directory
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-100">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Sender Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name</label>
              <input
                type="text"
                required
                placeholder="John Doe"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
              />
            </div>

            {/* Sender Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Email Address</label>
              <input
                type="email"
                required
                disabled={!!currentUser?.email}
                placeholder="john@example.org"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 ${currentUser?.email ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""}`}
              />
            </div>

            {/* Message Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
              <input
                type="text"
                required
                placeholder="Directory correction / Technical bug / Guidelines appeal"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
              />
            </div>

            {/* Message Text area */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inquiry / Message Details</label>
              <textarea
                required
                rows={4}
                placeholder="Type your message to the administrator here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 resize-none"
              />
            </div>

             {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className={`flex items-center gap-2 rounded-xl ${activeTheme.primaryBg} px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:${activeTheme.primaryHoverBg} active:scale-98 transition disabled:opacity-50 cursor-pointer`}
                title="Saves this message to the Admin Panel and opens your email application to send directly"
              >
                {isSending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send & Email</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
