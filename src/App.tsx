import React, { useState, useEffect, useMemo, useRef } from "react";
import { User } from "firebase/auth";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { 
  Search, 
  Filter, 
  BookOpen, 
  UserCheck, 
  AlertCircle, 
  Info,
  CheckCircle,
  Sparkles,
  HelpCircle,
  Inbox,
  Plus,
  ShieldAlert
} from "lucide-react";
import AppBar from "./components/AppBar";
import ContributorCard from "./components/ContributorCard";
import ContactModal from "./components/ContactModal";
import ProfileEditForm from "./components/ProfileEditForm";
import AdminPanel from "./components/AdminPanel";
import ClaimProfileModal from "./components/ClaimProfileModal";
import ReportModal from "./components/ReportModal";
import ContactAdminModal from "./components/ContactAdminModal";
import MyInboxModal from "./components/MyInboxModal";
import { Contributor, DirectMessage } from "./types";
import { db, initAuth, handleFirestoreError, OperationType, isUserAdmin } from "./firebase";
import { THEMES, ThemeType } from "./lib/theme";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string>("");
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const randomWeights = useRef<Record<string, number>>({});
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("directory");
  
  // Theme state
  const [themeKey, setThemeKey] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("app_script_consultants_theme");
    return (saved as ThemeType) || "orange";
  });

  const activeTheme = THEMES[themeKey];

  const handleThemeChange = (key: ThemeType) => {
    setThemeKey(key);
    localStorage.setItem("app_script_consultants_theme", key);
  };

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("app_script_consultants_dark_mode");
    if (saved !== null) {
      return saved === "true";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("app_script_consultants_dark_mode", String(isDarkMode));
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkillFilter, setSelectedSkillFilter] = useState<string | null>(null);
  const [showAllQuickSkills, setShowAllQuickSkills] = useState(false);

  // Modals state
  const [contactTarget, setContactTarget] = useState<Contributor | null>(null);
  const [editTarget, setEditTarget] = useState<Contributor | null>(null);
  const [myInboxActive, setMyInboxActive] = useState(false);
  const [myProfile, setMyProfile] = useState<Contributor | null>(null);
  const [claimTarget, setClaimTarget] = useState<Contributor | null>(null);
  const [reportTarget, setReportTarget] = useState<Contributor | null>(null);
  const [contactAdminOpen, setContactAdminOpen] = useState(false);

  // Delete profile handler
  const handleDeleteProfile = async (contributor: Contributor) => {
    const isOwner = !!(user && (contributor.userId === user.uid || (contributor.email && user.email && contributor.email.toLowerCase() === user.email.toLowerCase())));
    const isCurrentUserAdmin = isUserAdmin(user, contributors);
    
    if (!isOwner && !isCurrentUserAdmin) {
      alert("Permission denied: You do not have authorization to delete this profile.");
      return;
    }
    
    const confirmMessage = isCurrentUserAdmin && !isOwner
      ? `Administrator action: Are you absolutely sure you want to permanently delete ${contributor.name}'s profile?`
      : "Are you absolutely sure you want to permanently delete your profile? This action is irreversible.";
      
    if (window.confirm(confirmMessage)) {
      try {
        await deleteDoc(doc(db, "contributors", contributor.id));
        alert("Profile successfully deleted.");
      } catch (err: any) {
        console.error("Failed to delete contributor profile:", err);
        alert(`Failed to delete profile: ${err.message || err}`);
      }
    }
  };

  // Toggle profile visibility (hidden from directory)
  const handleToggleHideProfile = async (contributor: Contributor) => {
    const isOwner = !!(user && (contributor.userId === user.uid || (contributor.email && user.email && contributor.email.toLowerCase() === user.email.toLowerCase())));
    const isCurrentUserAdmin = isUserAdmin(user, contributors);
    if (!isOwner && !isCurrentUserAdmin) {
      alert("Permission denied: You do not have authorization to update this profile's visibility.");
      return;
    }
    
    try {
      const docRef = doc(db, "contributors", contributor.id);
      await updateDoc(docRef, { hidden: !contributor.hidden });
    } catch (err: any) {
      console.error("Failed to toggle profile visibility:", err);
      alert(`Failed to update visibility: ${err.message || err}`);
    }
  };

  // Initial Auth binding
  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        if (token) setGoogleToken(token);
        setIsAuthLoading(false);
      },
      () => {
        setUser(null);
        setGoogleToken("");
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Listen to Contributors Directory (Snapshot Real-time sync)
  useEffect(() => {
    setIsDataLoading(true);
    const q = collection(db, "contributors");
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Contributor[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Contributor);
        });

        // Initialize random weight for any seen contributor to maintain stable random order per session
        list.forEach((c) => {
          if (randomWeights.current[c.id] === undefined) {
            randomWeights.current[c.id] = Math.random();
          }
        });

        // Sort by the randomized weights
        list.sort((a, b) => randomWeights.current[a.id] - randomWeights.current[b.id]);

        setContributors(list);
        setIsDataLoading(false);
      },
      (error) => {
        console.error("Failed to load contributors:", error);
        setIsDataLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Find My claimed Profile
  useEffect(() => {
    if (user && contributors.length > 0) {
      const found = contributors.find((c) => c.userId === user.uid || (c.email && c.email.toLowerCase() === user.email?.toLowerCase()));
      setMyProfile(found || null);
    } else {
      setMyProfile(null);
    }
  }, [user, contributors]);

  // Administrative notifications state & listener
  const [adminMessages, setAdminMessages] = useState<DirectMessage[]>([]);

  useEffect(() => {
    if (user && isUserAdmin(user, contributors)) {
      const q = query(
        collection(db, "messages"),
        where("contributorUserId", "==", "admin")
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: DirectMessage[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as DirectMessage);
          });
          setAdminMessages(list);
        },
        (error) => {
          console.error("Failed to load admin messages for badge:", error);
          setAdminMessages([]);
        }
      );
      return () => unsubscribe();
    } else {
      setAdminMessages([]);
    }
  }, [user, contributors]);

  // Filter unread administrative messages
  const adminUnreadMessagesCount = useMemo(() => {
    return adminMessages.filter((m) => !m.read).length;
  }, [adminMessages]);

  // Unified administrative badge count (unread messages + pending profiles awaiting approval)
  const adminBadgeCount = useMemo(() => {
    if (!user || !isUserAdmin(user, contributors)) return 0;
    const pendingCount = contributors.filter((c) => c.status !== "approved").length;
    return adminUnreadMessagesCount + pendingCount;
  }, [user, contributors, adminUnreadMessagesCount]);

  // Personal messages snapshot listener (dual mapping: userId OR registered email)
  const [contributorMessages, setContributorMessages] = useState<DirectMessage[]>([]);

  useEffect(() => {
    if (!user) {
      setContributorMessages([]);
      return;
    }

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
      setContributorMessages(mergedList);
    };

    // 1. Query by authenticated UID
    const q1 = query(
      collection(db, "messages"),
      where("contributorUserId", "==", user.uid)
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
        console.error("Failed to load messages by UID:", error);
      }
    );

    // 2. Query by verified/registered email address
    const q2 = query(
      collection(db, "messages"),
      where("contributorEmail", "==", user.email)
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
        console.error("Failed to load messages by email:", error);
      }
    );

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [user]);

  // Unread personal messages count
  const myUnreadCount = useMemo(() => {
    return contributorMessages.filter((m) => !m.read).length;
  }, [contributorMessages]);

  // Real-time toast alerts state & seen messages tracking
  interface ToastNotification {
    id: string;
    title: string;
    body: string;
    type: "message" | "admin";
  }
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const seenMessagesRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef<{ personal: boolean; admin: boolean }>({ personal: false, admin: false });

  // Play browser-synthesized notification sound chime
  const playNotificationChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 (pleasant alert tone)
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5 (pleasant double beep)
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (err) {
      console.warn("Audio Context sound blocked or not supported:", err);
    }
  };

  // Dispatch floating real-time toaster alerts
  const addToastNotification = (title: string, body: string, type: "message" | "admin") => {
    const id = "toast_" + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, body, type }]);
    
    // Play sound alert
    playNotificationChime();

    // Trigger standard browser system push notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch (err) {
        console.warn("Browser Notification instantiation blocked:", err);
      }
    }

    // Dismiss toast automatically after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  // Unified real-time incoming message alert scanner
  useEffect(() => {
    // A. Personal Contributor Inbox Alerts
    if (contributorMessages.length > 0) {
      if (!initialLoadRef.current.personal) {
        // Mark existing inbox items as seen to avoid spawning alerts on start
        contributorMessages.forEach((m) => seenMessagesRef.current.add(m.id));
        initialLoadRef.current.personal = true;
      } else {
        contributorMessages.forEach((m) => {
          if (!m.read && !seenMessagesRef.current.has(m.id)) {
            seenMessagesRef.current.add(m.id);
            addToastNotification(
              `New Message from ${m.senderName}`,
              `Inquiry: "${m.subject}"`,
              "message"
            );
          }
        });
      }
    } else {
      initialLoadRef.current.personal = true;
    }

    // B. Administrator Alerts (New profile approvals or Flagged Profile reports)
    const isAdmin = user && isUserAdmin(user, contributors);
    if (isAdmin && adminMessages.length > 0) {
      if (!initialLoadRef.current.admin) {
        // Mark existing administrative logs as seen to avoid spamming alerts on start
        adminMessages.forEach((m) => seenMessagesRef.current.add(m.id));
        initialLoadRef.current.admin = true;
      } else {
        adminMessages.forEach((m) => {
          if (!m.read && !seenMessagesRef.current.has(m.id)) {
            seenMessagesRef.current.add(m.id);
            addToastNotification(
              "Admin Alert received!",
              `${m.senderName}: "${m.subject}"`,
              "admin"
            );
          }
        });
      }
    } else {
      initialLoadRef.current.admin = true;
    }
  }, [contributorMessages, adminMessages, user, contributors]);

  // Browser Tab Title Flash Alerting Mechanism
  useEffect(() => {
    const totalUnread = myUnreadCount + (user && isUserAdmin(user, contributors) ? adminUnreadMessagesCount : 0);
    if (totalUnread === 0) {
      document.title = "Consultant Directory";
      return;
    }

    let intervalId: any;
    let showAlternate = false;
    
    intervalId = setInterval(() => {
      document.title = showAlternate 
        ? `🔔 (${totalUnread}) New Inquiry!` 
        : "Consultant Directory";
      showAlternate = !showAlternate;
    }, 1500);

    return () => {
      clearInterval(intervalId);
      document.title = "Consultant Directory";
    };
  }, [myUnreadCount, adminUnreadMessagesCount, user, contributors]);

  // Seed sample data if Firestore is fresh/empty
  const seedBootstrapData = async () => {
    const bootstrap: Contributor[] = [
      {
        id: "bruce-mcpher",
        name: "Bruce Mcpher",
        email: "bruce@mcpher.com",
        role: "Lead Platform Architect",
        bio: "Specializing in Google Workspace APIs, Firebase integrations, and serverless architectures. Contributor since inception.",
        skills: ["Workspace API", "Firebase", "TypeScript", "React"],
        status: "approved",
        systemRole: "admin",
        slideIndex: 1,
        github: "https://github.com",
        linkedin: "https://linkedin.com",
        company: "Google Developer Expert",
        phone: "+1 (555) 012-3456",
      },
      {
        id: "jane-doe",
        name: "Jane Doe",
        email: "jane@company.com",
        role: "Senior UX Designer",
        bio: "Passionate about creating clean material-inspired experiences with optimal typography and fluid spacing grids.",
        skills: ["UX Design", "Figma", "Tailwind CSS", "Acoustics"],
        status: "approved",
        systemRole: "contributor",
        slideIndex: 2,
        github: "https://github.com",
        website: "https://google.com",
        company: "UiCraft Studio",
        phone: "+1 (555) 987-6543",
      }
    ];

    try {
      for (const item of bootstrap) {
        await setDoc(doc(db, "contributors", item.id), item);
      }
    } catch (err) {
      console.error("Bootstrap seeding error:", err);
    }
  };

  // Claim Profile function
  const handleClaimProfile = (contributor: Contributor) => {
    if (!user) {
      alert("Please sign in using Google to claim a profile.");
      return;
    }
    setClaimTarget(contributor);
  };

  const handleOpenMyProfile = () => {
    if (!user) {
      alert("Please sign in first!");
      return;
    }
    if (myProfile) {
      setEditTarget(myProfile);
    } else {
      const confirmCreate = window.confirm(
        "We couldn't find an existing contributor card matching your email address. Would you like to create your own profile from scratch?"
      );
      if (confirmCreate) {
        // Build a fresh template for new contributor profiles
        const newCard: Contributor = {
          id: "user-" + user.uid,
          name: user.displayName || "",
          email: user.email || "",
          avatarUrl: user.photoURL || "",
          role: "",
          bio: "",
          skills: [],
          status: "pending",
          userId: user.uid,
          systemRole: "contributor"
        };
        setEditTarget(newCard);
      }
    }
  };

  const handleCreateProfileFromScratch = () => {
    if (!user) {
      alert("Please sign in first!");
      return;
    }
    // Check if there is an existing card matching their identity
    const existingProfile = contributors.find(
      (c) => c.userId === user.uid || (c.email && user.email && c.email.toLowerCase() === user.email.toLowerCase())
    );
    if (existingProfile) {
      const confirmEdit = window.confirm(
        `We found an existing profile for you (${existingProfile.name}). Would you like to edit your existing profile instead?`
      );
      if (confirmEdit) {
        setEditTarget(existingProfile);
      }
      return;
    }

    const newId = "profile-" + Math.floor(100000 + Math.random() * 900000);
    const newCard: Contributor = {
      id: newId,
      name: user.displayName || "",
      email: user.email || "",
      avatarUrl: user.photoURL || "",
      role: "",
      bio: "",
      skills: [],
      status: isUserAdmin(user, contributors) ? "approved" : "pending",
      userId: user.uid,
      systemRole: "contributor"
    };
    setEditTarget(newCard);
  };

  // Filter approved directories (and exclude hidden ones except for owners & administrators)
  const approvedList = contributors.filter((c) => {
    const isOwner = !!(user && (c.userId === user.uid || (c.email && user.email && c.email.toLowerCase() === user.email.toLowerCase())));
    const isCurrentUserAdmin = isUserAdmin(user, contributors);
    const isHidden = c.hidden === true;
    
    if (isHidden && !isOwner && !isCurrentUserAdmin) {
      return false;
    }
    return c.status === "approved" || isOwner;
  });

  // Search filter
  const filteredContributors = approvedList.filter((c) => {
    const query = searchQuery.toLowerCase().trim();
    const nameStr = c.name || "";
    const roleStr = c.role || "";
    const bioStr = c.bio || "";
    const skillsArr = c.skills || [];

    const matchesSearch = 
      nameStr.toLowerCase().includes(query) ||
      roleStr.toLowerCase().includes(query) ||
      bioStr.toLowerCase().includes(query) ||
      skillsArr.some((s) => s && s.toLowerCase().includes(query));

    const matchesSkill = selectedSkillFilter 
      ? skillsArr.some((s) => s && s.trim().toLowerCase().includes(selectedSkillFilter.trim().toLowerCase()))
      : true;

    return matchesSearch && matchesSkill;
  });

  // Calculate skill frequency map across all contributors
  const skillFrequency = useMemo(() => {
    const freq: Record<string, number> = {};
    contributors.forEach((c) => {
      const skills = c.skills || [];
      skills.forEach((s) => {
        if (s) {
          const normalized = s.trim().toLowerCase();
          freq[normalized] = (freq[normalized] || 0) + 1;
        }
      });
    });
    return freq;
  }, [contributors]);

  // Extract all unique skills across approved profiles for selective quick-filters, sorted by frequency
  const allSkills = useMemo(() => {
    const unique = Array.from(
      new Set(
        approvedList
          .flatMap((c) => c.skills || [])
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      )
    ) as string[];
    return unique.sort((a, b) => {
      const freqA = skillFrequency[a] || 0;
      const freqB = skillFrequency[b] || 0;
      if (freqB !== freqA) {
        return freqB - freqA; // descending order of frequency (most common first)
      }
      return a.localeCompare(b); // alphabetical fallback
    });
  }, [approvedList, skillFrequency]);

  const QUICK_SKILLS_LIMIT = 8;
  const hasMoreQuickSkills = allSkills.length > QUICK_SKILLS_LIMIT;
  const displayedQuickSkills = showAllQuickSkills ? allSkills : allSkills.slice(0, QUICK_SKILLS_LIMIT);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col text-slate-800 dark:text-slate-100 antialiased selection:bg-blue-200 dark:selection:bg-blue-900 selection:text-slate-900 dark:selection:text-white transition-colors duration-200">
      
      {/* Top Bar AppBar */}
      <AppBar
        user={user}
        onUserUpdate={(u, token) => {
          setUser(u);
          if (token) setGoogleToken(token);
        }}
        isLoading={isAuthLoading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMyProfile={handleOpenMyProfile}
        activeTheme={activeTheme}
        onThemeChange={handleThemeChange}
        contributors={contributors}
        adminBadgeCount={adminBadgeCount}
        inboxUnreadCount={myUnreadCount}
        onOpenInbox={() => setMyInboxActive(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Profile Edit Trigger Mode */}
        {editTarget ? (
          <div className="animate-fade-in">
            <ProfileEditForm
              contributor={editTarget}
              onCancel={() => setEditTarget(null)}
              activeTheme={activeTheme}
              isAdmin={isUserAdmin(user, contributors)}
              isNew={!contributors.some((c) => c.id === editTarget.id)}
              onSaveSuccess={(updated) => {
                setEditTarget(null);
                setContributors((prev) => {
                  const exists = prev.some((c) => c.id === updated.id);
                  if (exists) {
                    return prev.map((c) => c.id === updated.id ? updated : c);
                  } else {
                    return [...prev, updated];
                  }
                });
              }}
            />
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Tab: General Directory Browser */}
            {activeTab === "directory" && (
              <div className="space-y-6">
                
                {/* Banner / Guide */}
                <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                  <div className="flex-1 space-y-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${activeTheme.primaryBgLight} ${activeTheme.primaryText} border ${activeTheme.primaryBorderLight}`}>
                      <Sparkles className={`h-3.5 w-3.5 ${activeTheme.primaryText}`} />
                      Active Community Ledger
                    </span>
                    <h2 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                      Find, Connect, and Support Apps Script Consultants.
                    </h2>
                    <p className="text-slate-500 dark:text-slate-450 text-sm sm:text-base max-w-2xl leading-relaxed">
                      A visual directory derived from our live Google Slides index. Contributors can claim cards to update progress, and visitors can contact them directly. Found an error or have guidelines feedback?{" "}
                      <button 
                        onClick={() => setContactAdminOpen(true)}
                        className={`font-bold transition hover:underline inline-flex items-center gap-0.5 cursor-pointer ${activeTheme.primaryText}`}
                      >
                        Message Administrator
                      </button>
                    </p>
                  </div>
                  
                  {/* Quick details */}
                  <div className="flex flex-row md:flex-col gap-4 items-center sm:items-start p-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800 divide-x md:divide-x-0 md:divide-y divide-slate-200 dark:divide-slate-700 shrink-0">
                    <div className="px-3 md:px-0 md:pb-2.5">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Approved Profiles</p>
                      <p className={`text-2xl font-black ${activeTheme.primaryText} mt-0.5`}>{approvedList.length}</p>
                    </div>
                    <div className="pl-4 md:pl-0 md:pt-2.5 pr-2">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">Total Skills Registered</p>
                      <p className={`text-2xl font-black ${activeTheme.primaryText} mt-0.5`}>{allSkills.length}</p>
                    </div>
                  </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  {/* Search Bar & Optional Action */}
                  <div className="flex flex-col sm:flex-row gap-3 w-full lg:max-w-xl items-stretch sm:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search name, job title, skills..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-slate-100 pl-11 pr-4 py-3 rounded-2xl text-sm outline-none transition focus:border-slate-400 dark:focus:border-slate-700 focus:ring-2 ${activeTheme.primaryRing} placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-xs`}
                      />
                    </div>
                    {user && (
                      <button
                        onClick={handleCreateProfileFromScratch}
                        className={`flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold text-white shadow-xs transition-all whitespace-nowrap cursor-pointer ${activeTheme.primaryBg} hover:opacity-90`}
                      >
                        <Plus className="h-4 w-4" />
                        Create Profile
                      </button>
                    )}
                  </div>

                  {/* Quick skills filter */}
                  {allSkills.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto max-w-full pb-1 select-none">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
                        <Filter className="h-3.5 w-3.5" />
                        Skills:
                      </span>
                      <button
                        onClick={() => setSelectedSkillFilter(null)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                          selectedSkillFilter === null
                            ? `${activeTheme.primaryBg} text-white shadow-xs`
                            : "bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-350 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        All
                      </button>
                      {displayedQuickSkills.map((skill) => (
                        <button
                          key={skill}
                          onClick={() => setSelectedSkillFilter(skill)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                            selectedSkillFilter === skill
                              ? `${activeTheme.primaryBg} text-white shadow-xs`
                              : "bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-350 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {skill}
                        </button>
                      ))}
                      {hasMoreQuickSkills && (
                        <button
                          onClick={() => setShowAllQuickSkills(!showAllQuickSkills)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border border-slate-200 dark:border-slate-800 cursor-pointer ${
                            showAllQuickSkills
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-850 dark:text-slate-200"
                              : `${activeTheme.primaryText} bg-white dark:bg-slate-900 hover:${activeTheme.primaryBgLight} hover:${activeTheme.primaryBorderLight}`
                          }`}
                        >
                          {showAllQuickSkills ? "Show less" : `...+${allSkills.length - QUICK_SKILLS_LIMIT} more`}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Directory Bento Grid */}
                {isDataLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className={`h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-current ${activeTheme.primaryText}`}></div>
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Retrieving contributor directory...</span>
                  </div>
                ) : contributors.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl py-16 sm:py-24 text-center px-4 max-w-xl mx-auto space-y-4">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center mx-auto ${activeTheme.primaryBgLight} ${activeTheme.primaryText}`}>
                      <Info className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-sans text-lg font-bold text-slate-900 dark:text-white">Database Directory is Empty</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        There are currently no active profiles. You can run the slide importer CLI tool, or seed sample sandbox profiles below.
                      </p>
                    </div>
                    {isUserAdmin(user, contributors) && (
                      <button
                        id="seed-sandbox-profiles-btn"
                        onClick={seedBootstrapData}
                        className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white ${activeTheme.primaryBg} rounded-xl hover:${activeTheme.primaryHoverBg} transition shadow-xs`}
                      >
                        <Sparkles className="h-4 w-4" />
                        Seed Sandbox Profiles
                      </button>
                    )}
                  </div>
                ) : filteredContributors.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl py-24 text-center px-4">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4 ${activeTheme.primaryBgLight} ${activeTheme.primaryText}`}>
                      <Info className="h-6 w-6" />
                    </div>
                    <h3 className="font-sans text-lg font-bold text-slate-900 dark:text-white">No Contributors Found</h3>
                    <p className="text-sm text-slate-400 dark:text-slate-450 mt-1 max-w-md mx-auto">
                      No cards match your query. Try clearing filters or refining search terms.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                    {filteredContributors.map((c) => (
                      <ContributorCard
                        key={c.id}
                        contributor={c}
                        currentUserId={user?.uid || null}
                        currentUserEmail={user?.email || null}
                        isAdmin={isUserAdmin(user, contributors)}
                        onContact={(target) => setContactTarget(target)}
                        onEdit={(target) => setEditTarget(target)}
                        onClaim={handleClaimProfile}
                        onDelete={handleDeleteProfile}
                        onToggleHide={handleToggleHideProfile}
                        onReport={(target) => setReportTarget(target)}
                        activeTheme={activeTheme}
                        skillFrequency={skillFrequency}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Direct Admin operations */}
            {activeTab === "admin" && isUserAdmin(user, contributors) && (
              <AdminPanel
                user={user}
                contributors={contributors}
                onRefreshContributors={() => {
                  // Force snapshot state checks
                }}
              />
            )}

          </div>
        )}
      </main>

      {/* Footer information bar */}
      <footer className="w-full bg-white border-t border-gray-100 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <p className="text-xs text-gray-400 font-medium">
            © 2026 Consultant Directory. Powered by Firestore with Google AI Studio.
          </p>
          <p className="text-[10px] text-gray-300 font-mono">
            Node: Sandbox • Version 1.1 • Location: europe-west2
          </p>
        </div>
      </footer>

      {/* Modals & Popups */}
      {contactTarget && (
        <ContactModal
          contributor={contactTarget}
          currentUser={user}
          onClose={() => setContactTarget(null)}
        />
      )}

      {claimTarget && (
        <ClaimProfileModal
          isOpen={true}
          contributor={claimTarget}
          currentUser={user}
          onClose={() => setClaimTarget(null)}
          onSuccess={() => {
            setClaimTarget(null);
          }}
        />
      )}

      {reportTarget && (
        <ReportModal
          contributor={reportTarget}
          currentUser={user}
          onClose={() => setReportTarget(null)}
          onSuccess={(updated) => {
            setReportTarget(null);
            setContributors((prev) => prev.map((c) => c.id === updated.id ? updated : c));
          }}
        />
      )}

      {contactAdminOpen && (
        <ContactAdminModal
          currentUser={user}
          onClose={() => setContactAdminOpen(false)}
          activeTheme={activeTheme}
        />
      )}

      {myInboxActive && user && (
        <MyInboxModal
          currentUser={user}
          onClose={() => setMyInboxActive(false)}
          activeTheme={activeTheme}
        />
      )}

      {/* Real-time floating toasts list */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-55 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-start gap-3 bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl animate-slide-in-right hover:scale-101 transition duration-200"
            >
              <div className="p-1.5 rounded-xl bg-slate-800 shrink-0">
                {toast.type === "admin" ? (
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                ) : (
                  <Inbox className="h-5 w-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1 space-y-0.5">
                <h4 className="font-sans text-xs font-bold text-slate-100">{toast.title}</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">{toast.body}</p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (toast.type === "admin") {
                        setActiveTab("admin");
                      } else {
                        setMyInboxActive(true);
                      }
                      // Remove toast after clicking action
                      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    }}
                    className="text-[10px] font-extrabold text-white bg-slate-800 hover:bg-slate-750 px-2.5 py-1 rounded-lg transition cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
