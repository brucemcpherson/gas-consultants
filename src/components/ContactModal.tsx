import React, { useState } from "react";
import { X, Send, CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { Contributor } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";

interface ContactModalProps {
  contributor: Contributor;
  currentUser: User | null;
  onClose: () => void;
}

export default function ContactModal({ contributor, currentUser, onClose }: ContactModalProps) {
  const [senderName, setSenderName] = useState(currentUser?.displayName || "");
  const [senderEmail, setSenderEmail] = useState(currentUser?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName || !senderEmail || !subject || !message) {
      setErrorMessage("Please fill in all details.");
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    // Create a secure clean message ID
    const messageId = "msg_" + Math.random().toString(36).substring(2, 15);
    const path = `messages/${messageId}`;

    try {
      // Build the message payload
      const messagePayload = {
        id: messageId,
        contributorId: contributor.id,
        contributorEmail: contributor.email,
        contributorUserId: contributor.userId || null, // Recipient userId for O(1) query enforcer list reads
        senderName: senderName.trim(),
        senderEmail: senderEmail.trim(),
        subject: subject.trim(),
        message: message.trim(),
        read: false,
        createdAt: serverTimestamp(), // Sync with request.time
      };

      // Write directly to Firestore with security validation
      await setDoc(doc(db, "messages", messageId), messagePayload);
      
      // Also open device's native email application
      const mailtoUrl = `mailto:${contributor.email}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(message.trim())}`;
      window.location.href = mailtoUrl;

      setIsSuccess(true);
    } catch (err) {
      console.error("Message send failure:", err);
      // STRICT error formatting compliant with firebase-integration skill
      try {
        handleFirestoreError(err, OperationType.CREATE, path);
      } catch (formattedErr: any) {
        setErrorMessage("Action Denied: Message could not be saved to Firestore.");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-905 p-6 border border-slate-100 dark:border-slate-800 shadow-2xl transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-sans text-lg font-bold text-slate-900 dark:text-white">Contact Contributor</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Sending message to <span className="font-semibold text-blue-650 dark:text-blue-400">{contributor.name}</span></p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/40 text-green-500 shadow-inner mb-4 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="font-sans text-base font-bold text-slate-900 dark:text-white">Message Sent!</h4>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-450 max-w-xs">
              Your message was sent successfully to {contributor.name}. They will receive it in their dashboard inbox.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-slate-900 dark:bg-slate-800 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-slate-800 dark:hover:bg-slate-705 transition cursor-pointer"
            >
              Continue Browsing
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-450 border border-red-100 dark:border-red-900/40">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Sender Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-705 dark:text-slate-300 mb-1">Your Full Name</label>
              <input
                type="text"
                required
                placeholder="Jane Doe"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 dark:focus:border-blue-700 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 dark:placeholder:text-slate-650"
              />
            </div>

            {/* Sender Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-705 dark:text-slate-300 mb-1">Your Email Address</label>
              <input
                type="email"
                required
                disabled={!!currentUser?.email}
                placeholder="jane@organization.org"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className={`w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 dark:focus:border-blue-700 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 dark:placeholder:text-slate-650 ${currentUser?.email ? "bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-450 cursor-not-allowed" : ""}`}
              />
            </div>

            {/* Message Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-705 dark:text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                required
                placeholder="Collaboration opportunity / Feedback"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 dark:focus:border-blue-700 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 dark:placeholder:text-slate-650"
              />
            </div>

            {/* Message Text area */}
            <div>
              <label className="block text-xs font-semibold text-slate-705 dark:text-slate-300 mb-1">Your Message</label>
              <textarea
                required
                rows={4}
                placeholder="Explain the background and context of your inquiry..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 dark:focus:border-blue-700 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 dark:placeholder:text-slate-650 resize-none"
              />
            </div>

             {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-550 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 active:scale-98 transition disabled:opacity-50 cursor-pointer"
                title="Saves this message to their Inbox and opens your email application to send directly"
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
