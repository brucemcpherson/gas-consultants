import React, { useState } from "react";
import { User } from "firebase/auth";
import { Save, AlertTriangle, CheckCircle, ArrowLeft, Shield, Camera, Trash2, Upload, EyeOff, Plus, Link2 } from "lucide-react";
import { Contributor, AdditionalLink } from "../types";
import { db, handleFirestoreError, OperationType, auth } from "../firebase";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ThemeColors } from "../lib/theme";

interface ProfileEditFormProps {
  contributor: Contributor;
  onCancel: () => void;
  onSaveSuccess: (updatedContributor: Contributor) => void;
  activeTheme: ThemeColors;
  isAdmin?: boolean;
  isNew?: boolean;
}

export default function ProfileEditForm({
  contributor,
  onCancel,
  onSaveSuccess,
  activeTheme,
  isAdmin = false,
  isNew = false,
}: ProfileEditFormProps) {
  const [name, setName] = useState(contributor.name || "");
  const [role, setRole] = useState(contributor.role || "");
  const [company, setCompany] = useState(contributor.company || "");
  const [phone, setPhone] = useState(contributor.phone || "");
  const [slideNotes, setSlideNotes] = useState(contributor.slideNotes || "");
  const [bio, setBio] = useState(contributor.bio || "");
  const [skillsString, setSkillsString] = useState((contributor.skills || []).map((s) => s.toLowerCase()).join(", "));
  const [github, setGithub] = useState(contributor.github || "");
  const [linkedin, setLinkedin] = useState(contributor.linkedin || "");
  const [twitter, setTwitter] = useState(contributor.twitter || "");
  const [website, setWebsite] = useState(contributor.website || "");
  const [additionalLinks, setAdditionalLinks] = useState<AdditionalLink[]>(contributor.additionalLinks || []);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [systemRole, setSystemRole] = useState<"contributor" | "admin">(contributor.systemRole || "contributor");
  const [avatarUrl, setAvatarUrl] = useState(contributor.avatarUrl || auth.currentUser?.photoURL || "");
  const [hidden, setHidden] = useState(contributor.hidden || false);
  const [shareEmail, setShareEmail] = useState<boolean>(contributor.shareEmail !== false);
  const [images, setImages] = useState<string[]>(contributor.images || []);

  const handleAddAdditionalLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    setAdditionalLinks((prev) => [...prev, { label: newLinkLabel.trim(), url }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const handleRemoveAdditionalLink = (index: number) => {
    setAdditionalLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const [isAdditionalDragging, setIsAdditionalDragging] = useState(false);
  const [isCompressingAdditional, setIsCompressingAdditional] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAdditionalImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErrorMessage("Image is too large. Choose an image under 12MB.");
      return;
    }
    if (images.length >= 8) {
      setErrorMessage("Maximum limit of 8 images/slides reached.");
      return;
    }

    setIsCompressingAdditional(true);
    setErrorMessage(null);

    try {
      // Compress to landscape size (640x360) with 0.70 quality for under 50KB budget
      const compressedString = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const maxWidth = 640;
            const maxHeight = 360;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Canvas context is unavailable"));
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.70);
            resolve(dataUrl);
          };
          img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
      });

      setImages((prev) => [...prev, compressedString]);
    } catch (err) {
      console.error("Additional image optimization failed:", err);
      setErrorMessage("An error occurred while optimizing your slide image.");
    } finally {
      setIsCompressingAdditional(false);
    }
  };

  const removeAdditionalImage = (idxToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage("Image is too large. Please upload an image under 8MB.");
      return;
    }

    setIsCompressing(true);
    setErrorMessage(null);

    try {
      // Compress to 160x160 with 0.75 quality for an optimal balance of fidelity and file size (under 15KB)
      const compressedString = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxDim = 160;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Canvas context is unavailable"));
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            resolve(dataUrl);
          };
          img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
      });

      setAvatarUrl(compressedString);
    } catch (err) {
      console.error("Image optimization failed:", err);
      setErrorMessage("An error occurred while optimizing your profile picture. Please try again or provide a web link.");
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role || !bio) {
      setErrorMessage("Name, Role, and Bio are required fields.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Split skills
    const skillsList = Array.from(new Set(
      skillsString
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0)
    ));

    const path = `contributors/${contributor.id}`;

    try {
      // Build updated values conforming to Security rules:
      const patchData: any = {
        name: name.trim(),
        email: (contributor.email || auth.currentUser?.email || "").trim(), // ALWAYS include email to fulfill the rules and schema!
        role: role.trim(),
        bio: bio.trim(),
        skills: skillsList,
        github: github.trim() || null,
        linkedin: linkedin.trim() || null,
        twitter: twitter.trim() || null,
        website: website.trim() || null,
        company: company.trim() || null,
        phone: phone.trim() || null,
        slideNotes: slideNotes.trim() || null,
        systemRole: isAdmin ? systemRole : (contributor.systemRole || "contributor"),
        avatarUrl: avatarUrl.trim() || null,
        hidden: hidden,
        shareEmail: shareEmail,
        images: images,
        additionalLinks: additionalLinks,
        status: contributor.status || (isAdmin ? "approved" : "pending"), // ALWAYS include status to fulfill schema validation!
        updatedAt: serverTimestamp(), // MANDATORY timing verification
      };

      if (contributor.badges) {
        patchData.badges = contributor.badges;
      }

      if (isNew) {
        // Enforce pending status and owner identification for standard users to fulfill create rules
        patchData.userId = contributor.userId || null;
        patchData.createdAt = serverTimestamp(); // MANDATORY during creation write
        if (contributor.slideIndex !== undefined) {
          patchData.slideIndex = contributor.slideIndex;
        }
      } else {
        // For updates, preserve ownership if edited by admin, otherwise set owner on update if unowned
        if (isAdmin) {
          patchData.userId = contributor.userId || null;
        } else if (!contributor.userId && auth.currentUser) {
          patchData.userId = auth.currentUser.uid;
        } else if (contributor.userId) {
          patchData.userId = contributor.userId;
        }
      }

      // Apply setDoc or updateDoc depending on operation type
      const docRef = doc(db, "contributors", contributor.id);
      if (isNew) {
        await setDoc(docRef, patchData);
        setSuccessMessage("Profile created and submitted successfully! Standard profiles require administrator review.");

        // Automatically create a notification message for the administrator
        if (patchData.status === "pending") {
          try {
            const adminMsgId = "msg_admin_pending_" + Math.random().toString(36).substring(2, 15);
            const adminMsgPayload = {
              id: adminMsgId,
              contributorId: "admin",
              contributorEmail: "bruce@mcpher.com",
              contributorUserId: "admin",
              senderName: "System Alert",
              senderEmail: patchData.email || "system@directory.com",
              subject: `New Profile Pending Approval: ${patchData.name}`,
              message: `A new contributor profile for "${patchData.name}" has been created and is awaiting administrator review.\n\nName: ${patchData.name}\nRole: ${patchData.role}\nEmail: ${patchData.email}\nBio: ${patchData.bio}`,
              read: false,
              createdAt: serverTimestamp(),
            };
            await setDoc(doc(db, "messages", adminMsgId), adminMsgPayload);
          } catch (msgErr) {
            console.error("Failed to write automated pending profile alert:", msgErr);
          }
        }
      } else {
        await updateDoc(docRef, patchData);
        setSuccessMessage("Profile updated successfully!");
      }

      // Notify parent list
      onSaveSuccess({
        ...contributor,
        ...patchData,
        github: github.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        twitter: twitter.trim() || undefined,
        website: website.trim() || undefined,
        company: company.trim() || undefined,
        phone: phone.trim() || undefined,
        slideNotes: slideNotes.trim() || undefined,
        systemRole: isAdmin ? systemRole : (contributor.systemRole || "contributor"),
        avatarUrl: avatarUrl.trim() || undefined,
        hidden: hidden,
        shareEmail: shareEmail,
        images: images,
        additionalLinks: additionalLinks,
      });

      // Quick delay then exit edit mode
      setTimeout(() => {
        onCancel();
      }, 1600);

    } catch (err: any) {
      console.error("Profile transaction failed:", err);
      try {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
      } catch (formattedErr: any) {
        setErrorMessage(`Action Denied: Insufficient authorization or invalid schema parameters. Details: ${err.message || err}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-150 pb-4 mb-6">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-slate-50 rounded-xl text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h3 className="font-sans text-lg font-bold text-slate-900">
            {isNew ? "Create Contributor Profile" : "Edit Contributor Profile"}
          </h3>
          <p className="text-xs text-slate-500">
            {isNew ? "Submit your profile details to join our consultant registry." : "Update your details in the active directory."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {errorMessage && (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-100">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2.5 rounded-xl bg-green-50 p-3.5 text-xs text-green-700 border border-green-100">
            <CheckCircle className="h-4.5 w-4.5 shrink-0 text-green-550" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Profile Avatar Uploader Section */}
        <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50/50 border border-slate-150 rounded-2xl">
          {/* Circular Frame for Preview */}
          <div className="relative group w-20 h-20 shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile Avatar"
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-2xl object-cover border border-slate-200"
              />
            ) : (
              <div className={`w-full h-full rounded-2xl border border-slate-200 flex items-center justify-center font-sans font-extrabold text-lg ${activeTheme.primaryBgLight} ${activeTheme.primaryText}`}>
                {name ? name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "?"}
              </div>
            )}
            
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl("")}
                title="Remove image"
                className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-150 shadow-xs transition active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Action Zone / Drag-and-Drop Area */}
          <div className="flex-1 space-y-2 text-center sm:text-left w-full">
            <label className="block text-xs font-bold text-slate-750">Profile Picture</label>
            
            <label
              htmlFor="avatar-upload-file-input"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleImageFile(file);
              }}
              className={`block border border-dashed rounded-xl p-4 text-center cursor-pointer transition ${
                isDragging 
                  ? "border-blue-500 bg-blue-50/20" 
                  : "border-slate-200 hover:border-slate-350 bg-white"
              }`}
            >
              <input
                type="file"
                id="avatar-upload-file-input"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFile(file);
                }}
                className="sr-only"
              />
              {isCompressing ? (
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-550 py-1.5">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
                  Optimizing image...
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Camera className="h-5 w-5 text-slate-400" />
                  <p className="text-[11px] font-bold text-slate-650">
                    Drag & drop, or <span className={`${activeTheme.primaryText} hover:underline`}>browse to upload</span>
                  </p>
                  <p className="text-[9.5px] text-slate-400 font-medium">JPEG, PNG, or WebP. Compressed on-device.</p>
                  <div className="mt-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-3 py-1 rounded-lg border border-slate-200 transition inline-block">
                    Choose Photo File
                  </div>
                </div>
              )}
            </label>
            
            {/* Link option as alternative */}
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                <span className="text-[9px] text-slate-405 font-extrabold uppercase tracking-wider shrink-0">OR LINK DIRECT WEB URL</span>
                <div className="h-px bg-slate-100 flex-1"></div>
              </div>
              {auth.currentUser?.photoURL && avatarUrl !== auth.currentUser.photoURL && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(auth.currentUser?.photoURL || "")}
                  className={`text-[9px] font-bold ${activeTheme.primaryText} hover:underline cursor-pointer bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 transition whitespace-nowrap`}
                >
                  Use Google Photo
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="e.g., https://github.com/identicons/user.png"
              value={avatarUrl.startsWith("data:") ? "" : avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs outline-none transition focus:border-slate-400 focus:ring-1 ${activeTheme.primaryRing}`}
            />
          </div>
        </div>

        {/* Basic Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-705 mb-1">Display Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing}`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-705 mb-1">Job Title / Role *</label>
            <input
              type="text"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing}`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-705 mb-1">Company / Organization</label>
            <input
              type="text"
              value={company}
              placeholder="e.g. Google, independent"
              onChange={(e) => setCompany(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing}`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-705 mb-1">Phone Number (Optional)</label>
            <input
              type="tel"
              value={phone}
              placeholder="e.g. +1 (555) 019-2834"
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing}`}
            />
          </div>
        </div>

        {/* Bio Text area */}
        <div>
          <label className="block text-xs font-bold text-slate-705 mb-1">Biography / About Me</label>
          <textarea
            required
            rows={5}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing} resize-none leading-relaxed`}
          />
        </div>

        {/* Slide Notes / Extra Context */}
        <div>
          <label className="block text-xs font-bold text-slate-705 mb-1">Slide Context & Custom Notes</label>
          <textarea
            rows={3}
            value={slideNotes}
            placeholder="Extra text or background notes retrieved during slides extraction..."
            onChange={(e) => setSlideNotes(e.target.value)}
            className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing} resize-none leading-relaxed`}
          />
          <p className="text-[10px] text-slate-400 mt-1">Additional descriptive facts or contextual pointers extracted from the presenter slide.</p>
        </div>

        {/* Skills Tag input */}
        <div>
          <label className="block text-xs font-bold text-slate-705 mb-1">Skills (Comma-separated)</label>
          <input
            type="text"
            placeholder="React, CSS, Node.js, Project Management"
            value={skillsString}
            onChange={(e) => setSkillsString(e.target.value)}
            className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing}`}
          />
          <p className="text-[10px] text-slate-400 mt-1">Provide individual skills separated by commas.</p>
        </div>

        {/* Additional Slide Snapshots & Work Images Showcase */}
        <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Additional Slide Snapshots & Photos</h4>
              <p className="text-[10px] text-slate-400">Upload slides, credentials, portfolio items, or extra documents (up to 8 files).</p>
            </div>
            <span className="text-xs font-bold text-slate-400 select-none bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              {images.length}/8 slots
            </span>
          </div>

          {/* Grid of existing additional images */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map((imgSrc, idx) => (
                <div key={idx} className="relative group rounded-xl border border-slate-150 overflow-hidden bg-slate-50 aspect-video select-none">
                  <img
                    src={imgSrc}
                    alt={`Showcase item ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => removeAdditionalImage(idx)}
                      className="p-1.5 rounded-full bg-white text-red-500 hover:scale-105 active:scale-95 shadow-md transition"
                      title="Delete snapshot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {/* No slide/image tags on image previews per user request */}
                </div>
              ))}
            </div>
          )}

          {/* Additional Image Drag and Drop Area */}
          {images.length < 8 && (
            <label
              htmlFor="additional-images-input"
              onDragOver={(e) => {
                e.preventDefault();
                setIsAdditionalDragging(true);
              }}
              onDragLeave={() => setIsAdditionalDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsAdditionalDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleAdditionalImageFile(file);
              }}
              className={`block border border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                isAdditionalDragging
                  ? "border-blue-500 bg-blue-50/20"
                  : "border-slate-200 hover:border-slate-350 bg-slate-50/50"
              }`}
            >
              <input
                type="file"
                id="additional-images-input"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAdditionalImageFile(file);
                }}
                className="sr-only"
              />
              {isCompressingAdditional ? (
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 py-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
                  Optimizing showcase slide image...
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-1">
                  <Upload className="h-5.5 w-5.5 text-slate-400" />
                  <p className="text-[11px] font-bold text-slate-650">
                    Drag & drop a slide photo, or <span className={`${activeTheme.primaryText} hover:underline`}>browse files</span>
                  </p>
                  <p className="text-[9.5px] text-slate-400 font-medium">JPEG, PNG, WebP or SVG. Auto-rescaled & compressed on-device.</p>
                  <div className={`mt-2 ${activeTheme.primaryBg} hover:opacity-90 text-white text-xs font-bold px-4 py-1.5 rounded-xl transition inline-block shadow-xs`}>
                    Choose Portfolio / Slide File ({images.length}/8)
                  </div>
                </div>
              )}
            </label>
          )}
        </div>

        {/* Profile Visibility & Email Sharing Controls */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 select-none">
          {/* Row 1: Slide Directory Visibility */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1 max-w-md">
              <label className="text-xs font-bold text-slate-705 flex items-center gap-1.5 font-sans uppercase tracking-wide">
                <EyeOff className="h-4 w-4 text-slate-500" />
                Directory Visibility
              </label>
              <p className="text-[10px] text-slate-500 leading-normal">
                Hide this profile card from the public contributor directory and slide viewer. Extremely useful for administrators who want backend panel privileges without having to maintain public cards.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500">
                {hidden ? "Hidden from public" : "Visible in public view"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => setHidden(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-800`}></div>
              </label>
            </div>
          </div>

          {/* Row 2: Public Email Sharing */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-md">
              <label className="text-xs font-bold text-slate-705 flex items-center gap-1.5 font-sans uppercase tracking-wide">
                <EyeOff className="h-4 w-4 text-slate-500" />
                Email Display Setting
              </label>
              <p className="text-[10px] text-slate-500 leading-normal">
                Control whether your email address is shared publicly on your profile card. If turned off, your email remains private and hidden from the public directory.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500">
                {shareEmail ? "E-mail Publicly Shared" : "E-mail Hidden/Private"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareEmail}
                  onChange={(e) => setShareEmail(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-800`}></div>
              </label>
            </div>
          </div>
        </div>

        {/* Administrative settings for elevated users */}
        {isAdmin && (
          <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 sm:p-5 space-y-3.5 select-none">
            <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5 font-sans uppercase tracking-wide">
              <Shield className="h-4 w-4 text-amber-600" />
              Administrative Overrides
            </h4>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-sm">
                <label className="block text-xs font-bold text-slate-705">System Access Role</label>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Elevate this contributor profile so they gain complete Admin Panel access when they sign in.
                </p>
              </div>
              <select
                value={systemRole}
                onChange={(e) => setSystemRole(e.target.value as "contributor" | "admin")}
                className="bg-white border border-slate-220 text-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-amber-500/30"
              >
                <option value="contributor">Contributor (Normal Card Owner)</option>
                <option value="admin">Admin (Full Control Panel Access)</option>
              </select>
            </div>
          </div>
        )}

        {/* Social channels */}
        <div className="border-t border-slate-100 pt-4">
          <h4 className="font-sans text-xs font-bold text-slate-900 mb-3">Professional Social Profiles</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">GitHub (URL or Username)</label>
              <input
                type="text"
                value={github}
                placeholder="github.com/username"
                onChange={(e) => setGithub(e.target.value)}
                className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing} placeholder:text-slate-300`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">LinkedIn Profile Link</label>
              <input
                type="text"
                value={linkedin}
                placeholder="linkedin.com/in/username"
                onChange={(e) => setLinkedin(e.target.value)}
                className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing} placeholder:text-slate-300`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Twitter / X URL</label>
              <input
                type="text"
                value={twitter}
                placeholder="twitter.com/handle"
                onChange={(e) => setTwitter(e.target.value)}
                className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing} placeholder:text-slate-300`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Personal Website URL</label>
              <input
                type="text"
                value={website}
                placeholder="example.com"
                onChange={(e) => setWebsite(e.target.value)}
                className={`w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 ${activeTheme.primaryRing} placeholder:text-slate-300`}
              />
            </div>
          </div>

          {/* Custom clickable links section */}
          <div className="mt-5 bg-slate-50 border border-slate-150 rounded-2xl p-4">
            <h5 className="font-sans text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-slate-500" />
              <span>Additional Clickable Links</span>
            </h5>
            <p className="text-[11px] text-slate-500 mb-3">
              Add custom resources such as your blog, company portfolio, Medium article, YouTube presentation, or other professional profiles.
            </p>

            {additionalLinks.length > 0 && (
              <div className="space-y-2 mb-4">
                {additionalLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="font-bold text-slate-700 truncate max-w-[120px]">{link.label}</span>
                      <span className="text-slate-300">|</span>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline truncate max-w-[180px] sm:max-w-[280px]">
                        {link.url}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdditionalLink(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-slate-50 cursor-pointer"
                      title="Remove link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Label (e.g., Blog, Portfolio, Medium)"
                value={newLinkLabel}
                onChange={(e) => setNewLinkLabel(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none bg-white"
              />
              <input
                type="text"
                placeholder="URL (e.g., medium.com/@user)"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                className="flex-[2] rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none bg-white"
              />
              <button
                type="button"
                onClick={handleAddAdditionalLink}
                className={`flex items-center justify-center gap-1 px-4 py-2 text-xs font-bold text-white rounded-xl active:scale-98 transition ${activeTheme.primaryBg} ${activeTheme.primaryHoverBg}`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-150 px-4 py-2.5 text-sm font-semibold text-slate-550 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md active:scale-98 transition disabled:opacity-50 ${activeTheme.primaryBg} ${activeTheme.primaryHoverBg} ${activeTheme.shadowAccent}`}
          >
            {isSaving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4.5 w-4.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
