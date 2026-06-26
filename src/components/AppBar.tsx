import React from "react";
import { User } from "firebase/auth";
import { LogOut, Shield, BookOpen, UserCheck, Palette, Inbox } from "lucide-react";
import { googleSignIn, logout, isUserAdmin } from "../firebase";
import { ThemeColors, ThemeType } from "../lib/theme";
import { Contributor } from "../types";

interface AppBarProps {
  user: User | null;
  onUserUpdate: (user: User | null, token: string) => void;
  isLoading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMyProfile: () => void;
  activeTheme: ThemeColors;
  onThemeChange: (theme: ThemeType) => void;
  contributors: Contributor[];
  adminBadgeCount?: number;
  inboxUnreadCount?: number;
  onOpenInbox: () => void;
}

export default function AppBar({
  user,
  onUserUpdate,
  isLoading,
  activeTab,
  setActiveTab,
  onOpenMyProfile,
  activeTheme,
  onThemeChange,
  contributors,
  adminBadgeCount = 0,
  inboxUnreadCount = 0,
  onOpenInbox,
}: AppBarProps) {
  
  const handleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        onUserUpdate(result.user, result.accessToken);
      }
    } catch (err) {
      console.error("Login failure", err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onUserUpdate(null, "");
      setActiveTab("directory");
    } catch (err) {
      console.error("Logout failure", err);
    }
  };

  const isAdmin = isUserAdmin(user, contributors);

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100 shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("directory")}>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md ${activeTheme.logoColorClass}`}>
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-sans text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight">
              Consultant Directory
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <svg className="h-3.5 w-3.5 text-amber-500 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.89 9.38l-1.67-6.52c-.09-.37-.41-.64-.8-.66-.38-.02-.74.19-.89.54L12.44 9.9 8.35 2.14C8.17 1.8 7.82 1.58 7.43 1.6s-.73.25-.87.61L2.24 16.58l9.08 5.1c.42.24.94.24 1.37 0l9.08-5.1-2.88-7.2z" />
              </svg>
              <span className="font-mono text-[10px] text-slate-400 leading-none">Powered by Firestore</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex space-x-1 bg-slate-50 p-1.5 rounded-xl border border-slate-150">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "directory"
                ? `bg-white shadow-xs ${activeTheme.primaryText}`
                : "text-slate-550 hover:text-slate-900"
            }`}
          >
            Directory
          </button>

          {user && (
            <button
              onClick={onOpenInbox}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === "inbox"
                  ? `bg-white shadow-xs ${activeTheme.primaryText}`
                  : "text-slate-550 hover:text-slate-900"
              }`}
            >
              <Inbox className="h-4 w-4" />
              <span>My Inbox</span>
              {inboxUnreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white bg-blue-600 rounded-full animate-pulse shadow-xs">
                  {inboxUnreadCount}
                </span>
              )}
            </button>
          )}
          
          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "admin"
                  ? `bg-white shadow-xs ${activeTheme.primaryText}`
                  : "text-slate-550 hover:text-slate-900"
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Admin Panel</span>
              {adminBadgeCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white bg-red-600 rounded-full animate-pulse shadow-xs">
                  {adminBadgeCount}
                </span>
              )}
            </button>
          )}
        </nav>

        {/* Theme select & Authenticated Controls / Login Button */}
        <div className="flex items-center gap-3">
          
          {/* Aesthetic Palette Swapper */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-xl select-none scale-90 sm:scale-100">
            <Palette className="h-3.5 w-3.5 text-slate-400" />
            <div className="flex items-center gap-1">
              <button 
                onClick={() => onThemeChange("orange")} 
                className={`h-3 w-3 rounded-full bg-orange-500 cursor-pointer transition-transform ${activeTheme.id === "orange" ? "ring-2 ring-orange-500 ring-offset-1 scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"}`} 
                title="Classic Orange Theme" 
              />
              <button 
                onClick={() => onThemeChange("emerald")} 
                className={`h-3 w-3 rounded-full bg-emerald-500 cursor-pointer transition-transform ${activeTheme.id === "emerald" ? "ring-2 ring-emerald-500 ring-offset-1 scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"}`} 
                title="Google Emerald Theme" 
              />
              <button 
                onClick={() => onThemeChange("royal")} 
                className={`h-3 w-3 rounded-full bg-blue-500 cursor-pointer transition-transform ${activeTheme.id === "royal" ? "ring-2 ring-blue-500 ring-offset-1 scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"}`} 
                title="Workspace Royal Theme" 
              />
              <button 
                onClick={() => onThemeChange("terracotta")} 
                className={`h-3 w-3 rounded-full bg-amber-500 cursor-pointer transition-transform ${activeTheme.id === "terracotta" ? "ring-2 ring-amber-500 ring-offset-1 scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"}`} 
                title="Sunset Terracotta Theme" 
              />
              <button 
                onClick={() => onThemeChange("charcoal")} 
                className={`h-3 w-3 rounded-full bg-slate-800 cursor-pointer transition-transform ${activeTheme.id === "charcoal" ? "ring-2 ring-slate-800 ring-offset-1 scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"}`} 
                title="Deep Charcoal Theme" 
              />
            </div>
          </div>

          {isLoading ? (
            <div className={`h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-current ${activeTheme.primaryText}`}></div>
          ) : user ? (
            <div className="flex items-center gap-3">
              {/* Profile Shortcut */}
              <button
                onClick={onOpenMyProfile}
                className={`hidden sm:flex items-center gap-2 cursor-pointer group bg-slate-50 hover:${activeTheme.primaryBgLight} border border-slate-100 p-1.5 pr-3 rounded-full transition-all`}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User Avatar"}
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs uppercase border ${activeTheme.primaryBgLight} ${activeTheme.primaryText} ${activeTheme.primaryBorderLight}`}>
                    {(user.email || "C")[0]}
                  </div>
                )}
                <span className={`text-xs font-semibold text-slate-705 group-hover:${activeTheme.primaryText} truncate max-w-[100px]`}>
                  {user.displayName || "Contributor"}
                </span>
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                title="Log Out"
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-55 rounded-xl transition-all"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            /* Custom Styled Official Google sign in button conforming to GSI requirements */
            <button
              onClick={handleLogin}
              className={`flex items-center gap-2.5 bg-white border border-slate-200 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${activeTheme.primaryRing}`}
            >
              <svg className="h-4 w-4" viewBox="0 0 48 48" style={{ display: "block" }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Header */}
      <div className="flex md:hidden bg-slate-50 border-t border-slate-100 overflow-x-auto select-none">
        <div className="flex px-4 py-2 space-x-2">
          <button
            onClick={() => setActiveTab("directory")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === "directory" ? `${activeTheme.primaryBg} text-white shadow-xs` : "bg-white text-slate-650 border border-slate-150"
            }`}
          >
            Directory
          </button>
          {user && (
            <button
              onClick={onOpenInbox}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === "inbox" ? `${activeTheme.primaryBg} text-white shadow-xs` : "bg-white text-slate-650 border border-slate-150"
              }`}
            >
              <Inbox className="h-3 w-3" />
              <span>My Inbox</span>
              {inboxUnreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white bg-blue-600 rounded-full animate-pulse shadow-xs">
                  {inboxUnreadCount}
                </span>
              )}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === "admin" ? `${activeTheme.primaryBg} text-white shadow-xs` : "bg-white text-slate-650 border border-slate-150"
              }`}
            >
              <Shield className="h-3 w-3" />
              <span>Admin Panel</span>
              {adminBadgeCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white bg-red-600 rounded-full animate-pulse shadow-xs">
                  {adminBadgeCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
