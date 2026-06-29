import React, { useState, useMemo, useRef } from "react";
import Markdown from "react-markdown";
import { sanitizeMarkdownLinks } from "../lib/markdown";
import { 
  Github, 
  Linkedin, 
  Twitter, 
  Globe, 
  UserCheck, 
  MessageSquare, 
  Edit3, 
  CheckCircle, 
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Building,
  Phone,
  Eye,
  EyeOff,
  Mail,
  Trash2,
  Flag,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
  Link2
} from "lucide-react";
import { Contributor } from "../types";
import { ThemeColors } from "../lib/theme";

const markdownComponents = {
  p: ({ children }: any) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
  a: ({ href, children }: any) => (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
    >
      {children}
    </a>
  ),
  h1: ({ children }: any) => <h1 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-2 mb-1">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2 mb-1">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1.5 mb-1">{children}</h3>,
  ul: ({ children }: any) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }: any) => <li className="text-xs sm:text-sm text-slate-600 dark:text-slate-350">{children}</li>,
  strong: ({ children }: any) => <strong className="font-bold text-slate-800 dark:text-slate-200">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  code: ({ children }: any) => <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px] font-mono text-slate-700 dark:text-slate-300">{children}</code>,
};

interface ContributorCardProps {
  key?: any;
  contributor: Contributor;
  currentUserId: string | null;
  currentUserEmail?: string | null;
  isAdmin?: boolean;
  onContact: (c: Contributor) => void;
  onEdit: (c: Contributor) => void;
  onClaim: (c: Contributor) => any;
  onDelete?: (c: Contributor) => void;
  onToggleHide?: (c: Contributor) => void;
  onReport?: (c: Contributor) => void;
  activeTheme: ThemeColors;
  skillFrequency: Record<string, number>;
}

export default function ContributorCard({
  contributor,
  currentUserId,
  currentUserEmail,
  isAdmin,
  onContact,
  onEdit,
  onClaim,
  onDelete,
  onToggleHide,
  onReport,
  activeTheme,
  skillFrequency,
}: ContributorCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollNext = () => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth * 0.70;
      carouselRef.current.scrollBy({ left: cardWidth, behavior: "smooth" });
    }
  };

  const scrollPrev = () => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth * 0.70;
      carouselRef.current.scrollBy({ left: -cardWidth, behavior: "smooth" });
    }
  };

  const sortedSkills = useMemo(() => {
    if (!contributor.skills) return [];
    const uniqueLower = Array.from(
      new Set(
        contributor.skills
          .map((s) => (s || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
    return uniqueLower.sort((a, b) => {
      const freqA = skillFrequency[a] || 0;
      const freqB = skillFrequency[b] || 0;
      if (freqB !== freqA) {
        return freqB - freqA;
      }
      return a.localeCompare(b);
    });
  }, [contributor.skills, skillFrequency]);

  const SKILL_LIMIT = 6;
  const hasMoreSkills = sortedSkills.length > SKILL_LIMIT;
  const displayedSkills = showAllSkills ? sortedSkills : sortedSkills.slice(0, SKILL_LIMIT);

  // Social button utility
  const renderSocialIcon = (url: string | undefined, type: "github" | "linkedin" | "twitter" | "website") => {
    if (!url) return null;
    let icon = <Globe className="h-4.5 w-4.5" />;
    let label = "Website";
    let colorClass = "hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 dark:hover:text-amber-400";

    if (type === "github") {
      icon = <Github className="h-4.5 w-4.5" />;
      label = "GitHub";
      colorClass = "hover:text-black hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:text-white";
    } else if (type === "linkedin") {
      icon = <Linkedin className="h-4.5 w-4.5" />;
      label = "LinkedIn";
      colorClass = "hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 dark:hover:text-blue-400";
    } else if (type === "twitter") {
      icon = <Twitter className="h-4.5 w-4.5" />;
      label = "Twitter";
      colorClass = "hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-slate-800 dark:hover:text-sky-400";
    }

    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    return (
      <a
        href={normalizedUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        className={`p-2.5 rounded-xl border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 transition-all ${colorClass}`}
      >
        {icon}
      </a>
    );
  };

  const isOwner = !!(
    currentUserId && 
    (contributor.userId === currentUserId || 
     (contributor.email && currentUserEmail && contributor.email.toLowerCase() === currentUserEmail.toLowerCase()))
  );
  const isClaimable = !contributor.userId;

  // Render status badge for profiles belonging to the current owner
  const renderStatusBadge = () => {
    if (contributor.status === "pending") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
          <HelpCircle className="h-3 w-3" />
          Pending Approval
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
        <CheckCircle className="h-3 w-3" />
        Verified
      </span>
    );
  };

  return (
    <article className="flex flex-col h-full bg-white dark:bg-slate-900 border-2 border-solid border-slate-300 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative">
      {contributor.flagged && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border-b border-red-100 dark:border-red-900/40 text-[11px] text-red-750 dark:text-red-300 font-bold select-none">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500 animate-pulse" />
          <span>Under Review: Flagged {contributor.flagCount && contributor.flagCount > 1 ? `(${contributor.flagCount} reports)` : ""}</span>
        </div>
      )}
      {contributor.hidden && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-700 dark:text-slate-300 font-bold select-none">
          <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span>Hidden from general directory (Admin only view)</span>
        </div>
      )}

      <div className="p-5 flex-1 flex flex-col justify-between">
        
        {/* Top block */}
        <div>
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3.5">
              {/* Dynamic Avatar */}
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shrink-0 shadow-xs relative">
                {contributor.avatarUrl ? (
                  <img
                    src={contributor.avatarUrl}
                    alt={contributor.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center font-sans font-extrabold text-sm sm:text-base ${activeTheme.primaryBgLight} ${activeTheme.primaryText}`}>
                    {contributor.name ? contributor.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "?"}
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-sans font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-snug">
                  {contributor.name}
                </h4>
                <div className="flex flex-wrap items-center gap-x-2 mt-0.5 text-xs font-bold">
                  <span className={activeTheme.primaryText}>{contributor.role}</span>
                  {contributor.company && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                        <Building className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        {contributor.company}
                      </span>
                    </>
                  )}
                </div>
                {contributor.phone && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium select-text">
                    <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span>{contributor.phone}</span>
                  </div>
                )}
                {contributor.email && (contributor.shareEmail !== false || isOwner || currentUserEmail === "bruce@mcpher.com") && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium select-text">
                    <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    <span className="truncate">{contributor.email}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {/* Compact Badge Set */}
              <div className="flex items-center gap-1.5">
                {((contributor.badges && contributor.badges.includes("pioneer")) || (contributor.slideIndex !== undefined)) && (
                  <span 
                    className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500 text-white shadow-sm ring-2 ring-amber-150 hover:scale-115 hover:rotate-45 transition-all duration-300 cursor-help" 
                    title="Pioneer: Founder member imported from Google Slides"
                  >
                    <Compass className="h-3 w-3" />
                  </span>
                )}
                {contributor.badges && contributor.badges.map((badge) => {
                  if (badge === "pioneer") return null;
                  const shortLabel = badge.slice(0, 3).toUpperCase();
                  return (
                    <span 
                      key={badge} 
                      className="inline-flex items-center justify-center h-6 px-1.5 min-w-6 rounded-full text-[9px] font-extrabold tracking-tight uppercase bg-slate-500/10 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-500/25 dark:border-slate-700 shadow-xs hover:scale-105 transition-transform cursor-help"
                      title={badge.charAt(0).toUpperCase() + badge.slice(1)}
                    >
                      {shortLabel}
                    </span>
                  );
                })}
              </div>

              {contributor.hidden === true && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700" title="Hidden from public registry">
                  <EyeOff className="h-2.5 w-2.5" />
                  Hidden
                </span>
              )}
              {isOwner && renderStatusBadge()}
            </div>
          </div>

          {/* Bio Description with interactive Truncation */}
          <div className="mb-4">
            <div className={`markdown-body text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${isExpanded ? "" : "line-clamp-3"}`}>
              {contributor.bio ? (
                <Markdown components={markdownComponents}>{sanitizeMarkdownLinks(contributor.bio)}</Markdown>
              ) : (
                "No profile bio available."
              )}
            </div>
            {((contributor.bio && contributor.bio.length > 150) || contributor.slideNotes || (contributor.images && contributor.images.length > 0)) && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`mt-1.5 flex items-center gap-1 text-xs font-bold ${activeTheme.primaryText} ${activeTheme.primaryHoverText} focus:outline-none`}
              >
                {isExpanded ? (
                  <>
                    <span>Show less</span>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    <span>{contributor.slideNotes || (contributor.images && contributor.images.length > 0) ? "Show details" : "Read full bio"}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Slide Notes / Extra Descriptive Text */}
          {contributor.slideNotes && isExpanded && (
            <div className="mt-3.5 pt-3.5 border-t border-dashed border-slate-150 dark:border-slate-800 mb-4 animate-fade-in text-[12px]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 leading-none">
                Slide Context & Contextual Snippet
              </span>
              <div className="markdown-body text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <Markdown components={markdownComponents}>{sanitizeMarkdownLinks(contributor.slideNotes)}</Markdown>
              </div>
            </div>
          )}

          {/* Skills Matrix */}
          {sortedSkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5 select-none">
              {displayedSkills.map((skill, index) => (
                <span
                  key={index}
                  className={`px-2.5 py-1 text-[11px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-110 dark:border-slate-700 hover:${activeTheme.primaryBgLight} hover:${activeTheme.primaryText} hover:${activeTheme.primaryBorderLight} transition-colors`}
                >
                  {skill}
                </span>
              ))}
              {hasMoreSkills && (
                <button
                  onClick={() => setShowAllSkills(!showAllSkills)}
                  className={`px-2 py-0.5 text-[10px] font-bold ${activeTheme.primaryText} bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:${activeTheme.primaryBgLight} hover:${activeTheme.primaryBorderLight} transition-all cursor-pointer`}
                >
                  {showAllSkills ? "show less" : `...+${sortedSkills.length - SKILL_LIMIT} more`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Carousel slide/images section (Just before footer actions block) */}
        {contributor.images && contributor.images.length > 0 && (
          <div className="relative w-full mb-4 px-1 select-none">
            <div className="relative group">
              <div
                ref={carouselRef}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
              >
                {contributor.images.map((imgSrc, idx) => (
                  <div
                    key={idx}
                    className={`snap-start shrink-0 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 aspect-video relative group/item cursor-zoom-in shadow-xs ${
                      contributor.images!.length > 1 ? "w-[68%]" : "w-full"
                    }`}
                    onClick={() => {
                      setCurrentImageIdx(idx);
                      setActiveLightboxImg(imgSrc);
                    }}
                  >
                    <img
                      src={imgSrc}
                      alt={`${contributor.name} - Slide ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-350 group-hover/item:scale-[1.015]"
                    />
                    {/* No slide/image tags on image overlays per user request */}
                  </div>
                ))}
              </div>

              {contributor.images.length > 1 && (
                <>
                  {/* Prev Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollPrev();
                    }}
                    className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/95 dark:bg-slate-800/95 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-250 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:outline-none cursor-pointer z-10 border border-slate-100 dark:border-slate-700"
                    title="Previous Slide"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  {/* Next Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollNext();
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/95 dark:bg-slate-800/95 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-250 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:outline-none cursor-pointer z-10 border border-slate-100 dark:border-slate-700"
                    title="Next Slide"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions block */}
        <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Social channels */}
            <div className="flex flex-wrap items-center gap-1.5 max-w-[55%]">
              {renderSocialIcon(contributor.github, "github")}
              {renderSocialIcon(contributor.linkedin, "linkedin")}
              {renderSocialIcon(contributor.twitter, "twitter")}
              {renderSocialIcon(contributor.website, "website")}
              
              {/* Additional custom clickable links */}
              {contributor.additionalLinks && contributor.additionalLinks.map((link, idx) => {
                const normalizedUrl = link.url.startsWith("http") ? link.url : `https://${link.url}`;
                return (
                  <a
                    key={idx}
                    href={normalizedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={link.label}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-100 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50/60 dark:bg-slate-800/60 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    <Link2 className="h-3 w-3 text-slate-400 dark:text-slate-550" />
                    <span>{link.label}</span>
                  </a>
                );
              })}
            </div>

            {/* CTA Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Flag / Report button for signed in non-owners */}
              {!isOwner && currentUserId && onReport && (
                <button
                  onClick={() => onReport(contributor)}
                  title="Report profile as inappropriate"
                  className="flex items-center justify-center p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-100 transition"
                >
                  <Flag className="h-4 w-4" />
                </button>
              )}

              {/* Hide/Unhide Button (visible to owner or admin) */}
              {(isOwner || isAdmin) && onToggleHide && (
                <button
                  onClick={() => onToggleHide(contributor)}
                  title={contributor.hidden ? "Unhide this profile card" : "Hide this profile card from the public"}
                  className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  {contributor.hidden ? (
                    <>
                      <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Show</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Hide</span>
                    </>
                  )}
                </button>
              )}

              {/* Admin Edit button (for profiles they don't own) */}
              {isAdmin && !isOwner && (
                <button
                  onClick={() => onEdit(contributor)}
                  title="Admin: edit profile"
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold ${activeTheme.primaryText} ${activeTheme.primaryBgLight} dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 rounded-xl ${activeTheme.primaryBgLightHover} transition border ${activeTheme.primaryBorderLight}`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Admin Edit</span>
                </button>
              )}

              {/* Admin Delete button (for profiles they don't own) */}
              {isAdmin && !isOwner && onDelete && (
                <button
                  onClick={() => onDelete(contributor)}
                  title="Admin: delete profile"
                  className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-red-650 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-xl hover:bg-red-100 dark:hover:bg-red-900 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              )}

              {/* Primary action controls (Owner / Claimable / Visitor) */}
              {isOwner ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onEdit(contributor)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold ${activeTheme.primaryText} ${activeTheme.primaryBgLight} dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 rounded-xl ${activeTheme.primaryBgLightHover} transition border ${activeTheme.primaryBorderLight}`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(contributor)}
                      title="Permanently delete your profile"
                      className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-red-650 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 rounded-xl hover:bg-red-100 dark:hover:bg-red-950/60 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              ) : isClaimable && currentUserId ? (
                <button
                  onClick={() => onClaim(contributor)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-750"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Claim Profile
                </button>
              ) : !currentUserId ? (
                <button
                  onClick={() => {
                    alert("Please sign in using the button at the top-right of the page to contact this consultant.");
                  }}
                  className="flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-xl transition cursor-not-allowed"
                  title="Sign in to contact"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Sign in to Contact
                </button>
              ) : (
                <button
                  onClick={() => onContact(contributor)}
                  className={`flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold text-white ${activeTheme.primaryBg} rounded-xl shadow-xs ${activeTheme.shadowAccent} ${activeTheme.primaryHoverBg} transition`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Contact
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Full-Screen Image Lightbox */}
      {activeLightboxImg && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setActiveLightboxImg(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={() => setActiveLightboxImg(null)}
              className="absolute top-[-48px] right-2 text-white hover:text-slate-300 p-2 rounded-full bg-slate-900/50 hover:bg-slate-900 transition-colors focus:outline-none cursor-pointer"
              title="Close full-screen image"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={activeLightboxImg}
              alt="Full-sized snapshot"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()} // Prevent close on image click
            />
          </div>
        </div>
      )}
    </article>
  );
}
