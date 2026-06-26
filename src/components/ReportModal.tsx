import React, { useState } from "react";
import { X, Flag, AlertTriangle, CheckCircle2 } from "lucide-react";
import { User } from "firebase/auth";
import { doc, setDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { Contributor } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";

interface ReportModalProps {
  contributor: Contributor;
  currentUser: User | null;
  onClose: () => void;
  onSuccess: (updated: Contributor) => void;
}

const REPORT_REASONS = [
  "Inappropriate or offensive text/images",
  "Spam, advertisements, or promotional noise",
  "False profile claims / spoofing identity",
  "Incorrect details or dead references",
  "Other violations of community guidelines"
];

export default function ReportModal({
  contributor,
  currentUser,
  onClose,
  onSuccess,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!explanation.trim()) {
      setErrorMessage("Please provide a short explanation to help administrators review.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const reportId = "rep_" + Math.random().toString(36).substring(2, 15);
    const reportPath = `reports/${reportId}`;

    try {
      // 1. Save the formal report audit document in reports collection
      const reportPayload = {
        id: reportId,
        contributorId: contributor.id,
        contributorName: contributor.name,
        reason: selectedReason,
        explanation: explanation.trim(),
        reporterEmail: currentUser?.email || "anonymous_user",
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "reports", reportId), reportPayload);

      // Automatically create an administrative notification message about the flag/report
      try {
        const adminMsgId = "msg_admin_report_" + Math.random().toString(36).substring(2, 15);
        const adminMsgPayload = {
          id: adminMsgId,
          contributorId: "admin",
          contributorEmail: "bruce@mcpher.com",
          contributorUserId: "admin",
          senderName: "System Report",
          senderEmail: currentUser?.email || "anonymous_user",
          subject: `Profile Flagged: ${contributor.name}`,
          message: `The contributor profile for "${contributor.name}" has been flagged as inappropriate.\n\nReason: ${selectedReason}\nExplanation: ${explanation.trim()}\nReporter: ${currentUser?.email || "anonymous_user"}\nProfile ID: ${contributor.id}`,
          read: false,
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "messages", adminMsgId), adminMsgPayload);
      } catch (msgErr) {
        console.error("Failed to write automated report message:", msgErr);
      }

      // 2. Perform the allowed flag action on the contributor profile document itself
      const currentFlagCount = contributor.flagCount || 0;
      const currentReasons = contributor.flaggedReasons || [];
      
      const newFlagCount = currentFlagCount + 1;
      const updatedReasons = [...currentReasons, selectedReason];

      const contributorRef = doc(db, "contributors", contributor.id);
      await updateDoc(contributorRef, {
        flagged: true,
        flagCount: newFlagCount,
        flaggedReasons: arrayUnion(selectedReason),
      });

      // 3. Trigger state sync on success
      const updatedContributor: Contributor = {
        ...contributor,
        flagged: true,
        flagCount: newFlagCount,
        flaggedReasons: updatedReasons,
      };

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess(updatedContributor);
      }, 1800);

    } catch (err: any) {
      console.error("Failed to flag inappropriate content:", err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `contributors/${contributor.id}`);
      } catch (formattedErr: any) {
        setErrorMessage("Action Denied: You must be logged in to report/flag contributor profiles.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-500 animate-pulse" />
            <h3 className="font-sans text-base sm:text-lg font-bold text-slate-900">Report Inappropriate Profile</h3>
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
            <h4 className="font-sans text-base font-bold text-slate-900">Report Submitted</h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-xs leading-relaxed">
              This card was flagged as inappropriate. System administrators will review this profile against our community guidelines immediately.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            
            <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-650 leading-relaxed">
                You are flagging the profile for <b className="text-slate-900 font-bold">{contributor.name}</b>. Please select the option that best describes the issue.
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-100 flex items-start gap-2">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Select Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Primary Reason</label>
              <div className="space-y-2">
                {REPORT_REASONS.map((reason, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition select-none ${
                      selectedReason === reason
                        ? "border-red-200 bg-red-50/40 text-red-950 font-semibold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report_reason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="mt-0.5 h-3.5 w-3.5 text-red-600 focus:ring-red-500"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Explanation Details */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Detailed Explanation</label>
              <textarea
                required
                rows={3}
                placeholder="Please describe exactly what makes this posting inappropriate..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100 placeholder:text-slate-300 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4.5 py-2.5 text-xs font-bold text-white shadow-md shadow-red-100 hover:bg-red-700 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                    <span>Flagging...</span>
                  </>
                ) : (
                  <>
                    <Flag className="h-3.5 w-3.5" />
                    <span>Submit Report</span>
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
