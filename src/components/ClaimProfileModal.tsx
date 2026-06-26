import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  UserCheck
} from "lucide-react";
import { Contributor } from "../types";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

interface ClaimProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  contributor: Contributor | null;
  currentUser: any; // Firebase user
  onSuccess: () => void;
}

export default function ClaimProfileModal({
  isOpen,
  onClose,
  contributor,
  currentUser,
  onSuccess
}: ClaimProfileModalProps) {
  const [step, setStep] = useState<"init" | "success">("init");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useAccountEmail, setUseAccountEmail] = useState(true);
  const [customEmail, setCustomEmail] = useState("");

  // Reset state when modal opens/changes
  useEffect(() => {
    if (isOpen) {
      setStep("init");
      setError(null);
      setUseAccountEmail(true);
      setCustomEmail("");
    }
  }, [isOpen, contributor]);

  if (!isOpen || !contributor || !currentUser) return null;

  const targetEmail = useAccountEmail 
    ? (currentUser.email || "") 
    : (customEmail.trim() || currentUser.email || "");

  const handleClaimProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const docRef = doc(db, "contributors", contributor.id);
      
      // Step 1: Claim ownership of the profile card (links userId and updatedAt)
      // This is permitted by the "Claim profile (if currently unclaimed)" security rule
      await updateDoc(docRef, {
        userId: currentUser.uid,
        updatedAt: serverTimestamp()
      });

      // Step 2: Now that the user owns the card, update the contact email if desired or if it is empty
      // This is permitted by the "Contributor can edit their own profile" security rule
      const hasEmail = !!contributor.email && contributor.email.trim().length > 0;
      if (!hasEmail || targetEmail !== contributor.email) {
        await updateDoc(docRef, {
          email: targetEmail.trim(),
          updatedAt: serverTimestamp()
        });
      }

      setStep("success");
    } catch (err: any) {
      console.error("Direct Firestore claim error:", err);
      setError(err.message || "Failed to claim profile in the database");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseReset = () => {
    setStep("init");
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseReset}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
        />

        {/* Modal Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl z-10"
        >
          {/* Close trigger */}
          <button
            onClick={handleCloseReset}
            className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Heading */}
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <Shield className="h-5.5 w-5.5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Claim Profile</h3>
              <p className="text-xs text-slate-500">
                Identify and verify ownership of <b>{contributor.name}</b>
              </p>
            </div>
          </div>

          {/* Steps */}
          {step === "init" && (
            <form onSubmit={handleClaimProfile} className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-slate-700 leading-relaxed">
                <p className="font-semibold text-blue-800 mb-1">Direct Profile Linking</p>
                You are claiming this unclaimed contributor profile. Since you are securely signed in with Google, you can instantly link this card to your account and manage it.
              </div>

              {/* Contact Email setting */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Set Profile Contact Email</label>
                
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      checked={useAccountEmail}
                      onChange={() => setUseAccountEmail(true)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-semibold text-slate-700">Use my Google Account email</span>
                      <p className="text-slate-500 mt-0.5 font-mono text-[11px]">{currentUser.email}</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="radio"
                      checked={!useAccountEmail}
                      onChange={() => setUseAccountEmail(false)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-slate-700">Use a different contact email</span>
                      {!useAccountEmail && (
                        <div className="mt-2 relative">
                          <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            required
                            placeholder="e.g. name@domain.com"
                            value={customEmail}
                            onChange={(e) => setCustomEmail(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-slate-400 focus:ring-1 focus:ring-blue-100 font-sans"
                          />
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {error && (
                <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 p-3.5 text-xs font-semibold text-red-600 leading-relaxed">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer font-sans"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Link Profile & Update Email</span>
                  </>
                )}
              </button>
            </form>
          )}

          {step === "success" && (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Profile Claimed!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Excellent! The profile of <b>{contributor.name}</b> has been successfully associated with your account, and your contact email is updated to <b className="font-mono">{targetEmail}</b>. You can now update your details and manage your profile card directly.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  handleCloseReset();
                }}
                className="mt-2 w-full rounded-xl bg-slate-900 text-white font-semibold py-2.5 text-sm hover:bg-slate-800 active:bg-slate-950 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
