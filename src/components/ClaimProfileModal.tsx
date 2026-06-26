import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Mail,
  Key,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight
} from "lucide-react";
import { Contributor } from "../types";

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
  const [step, setStep] = useState<"init" | "verify" | "success">("init");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  if (!isOpen || !contributor || !currentUser) return null;

  const hasExistingEmail = !!contributor.email && contributor.email.trim().length > 0;

  // Step 1: Handle initial claim trigger
  const handleInitialClaim = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    setDevOtp(null);

    try {
      if (hasExistingEmail) {
        // Send email notification & claim directly
        const response = await fetch("/api/claim/notify-and-claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contributorId: contributor.id,
            claimantUid: currentUser.uid,
            claimantName: currentUser.displayName || currentUser.email?.split("@")[0] || "User",
            claimantEmail: currentUser.email || ""
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to notify and claim profile");
        }

        if (data.notice) {
          setNotice(data.notice);
        }
        setStep("success");
      } else {
        // No existing email, validate user-entered email first
        if (!email.trim() || !email.includes("@")) {
          throw new Error("Please enter a valid email address");
        }

        const response = await fetch("/api/claim/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            contributorId: contributor.id
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to send verification code");
        }

        if (data.notice) {
          setNotice(data.notice);
        }
        if (data.otpCodeFallback) {
          setDevOtp(data.otpCodeFallback);
        }
        setStep("verify");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle code verification
  const handleVerifyCode = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      setError("Please enter a valid 6-digit verification code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/claim/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          contributorId: contributor.id,
          userId: currentUser.uid
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setStep("success");
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseReset = () => {
    setStep("init");
    setEmail("");
    setCode("");
    setError(null);
    setNotice(null);
    setDevOtp(null);
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
            <div className="space-y-4">
              {hasExistingEmail ? (
                /* Contributor ALREADY has an email */
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-slate-700 leading-relaxed">
                    <p className="font-semibold text-blue-800 mb-1">Email Protection Active</p>
                    This profile is registered with the email address:
                    <div className="my-2 select-all font-mono text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 max-w-max">
                      {contributor.email}
                    </div>
                    We will send an automated security alert to this email address notifying them that you are claiming the profile as your custom account.
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800 mb-1">Claimant Identity</p>
                    Your authorized Google account is:
                    <div className="mt-1 font-medium text-slate-800 select-text font-mono">
                      {currentUser.displayName} ({currentUser.email})
                    </div>
                  </div>
                </div>
              ) : (
                /* Contributor DOES NOT have an email */
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-xs text-slate-700 leading-relaxed">
                    <p className="font-semibold text-amber-800 mb-1">No Email Registered</p>
                    This profile currently has no registered email. To claim it, you must enter your email address below. We will send a 6-digit confirmation code to verify your access.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Your Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 p-3.5 text-xs font-semibold text-red-600 leading-relaxed">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={handleInitialClaim}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : hasExistingEmail ? (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Send Notice & Claim Profile</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-slate-700 leading-relaxed">
                <p className="font-semibold text-blue-800 mb-1">Verify Your Email</p>
                We have dispatched a 6-digit security code to <b>{email}</b>. Please enter the code below to complete the claim.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="Enter Code (e.g. 123456)"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full tracking-[4px] text-center rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-base font-bold text-slate-800 placeholder-slate-400 placeholder:tracking-normal outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Dev Simulation Notice */}
              {devOtp && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3.5 text-xs text-slate-700 leading-relaxed">
                  <p className="font-bold text-amber-800 mb-1">🛠️ Local Dev Simulation</p>
                  No mail servers are configured. We intercepted the OTP code for your convenience:
                  <div className="mt-2 font-mono text-base font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded px-2.5 py-1 text-center select-all max-w-[120px] mx-auto">
                    {devOtp}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 p-3.5 text-xs font-semibold text-red-600 leading-relaxed">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={handleVerifyCode}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Verify & Claim Profile</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep("init")}
                className="w-full text-center text-xs font-semibold text-blue-600 hover:underline transition-colors focus:outline-none"
              >
                Change email address
              </button>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Profile Claimed!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Excellent! The profile of <b>{contributor.name}</b> has been successfully associated with your account. You can now update edits and manage your data directly.
                </p>
              </div>

              {notice && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-500 leading-relaxed select-text font-medium text-left">
                  <b>System Notice:</b> {notice}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  handleCloseReset();
                }}
                className="mt-2 w-full rounded-xl bg-slate-905 bg-slate-900 border border-slate-800 text-white font-semibold py-2.5 text-sm hover:bg-slate-850 active:bg-slate-950 transition-colors cursor-pointer"
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
