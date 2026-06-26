export type ThemeType = "emerald" | "royal" | "terracotta" | "orange" | "charcoal";

export interface ThemeColors {
  id: ThemeType;
  name: string;
  desc: string;
  primary: string;           // e.g. "emerald-600"
  primaryBg: string;         // e.g. "bg-emerald-600"
  primaryHoverBg: string;    // e.g. "hover:bg-emerald-700"
  primaryText: string;       // e.g. "text-emerald-600"
  primaryHoverText: string;  // e.g. "hover:text-emerald-700"
  primaryBgLight: string;    // e.g. "bg-emerald-50"
  primaryBgLightHover: string; // e.g. "hover:bg-emerald-100"
  primaryBorderLight: string;// e.g. "border-emerald-100"
  primaryRing: string;       // e.g. "focus:ring-emerald-500"
  shadowAccent: string;      // e.g. "shadow-emerald-100"
  logoColorClass: string;    // e.g. "bg-emerald-600 shadow-emerald-100"
}

export const THEMES: Record<ThemeType, ThemeColors> = {
  emerald: {
    id: "emerald",
    name: "Google Emerald",
    desc: "A signature green accent matching Apps Script, Sheets, and cloud solutions",
    primary: "emerald-600",
    primaryBg: "bg-emerald-600",
    primaryHoverBg: "hover:bg-emerald-700",
    primaryText: "text-emerald-600",
    primaryHoverText: "hover:text-emerald-750",
    primaryBgLight: "bg-emerald-50/70",
    primaryBgLightHover: "hover:bg-emerald-100/80",
    primaryBorderLight: "border-emerald-100",
    primaryRing: "focus:ring-emerald-500",
    shadowAccent: "shadow-emerald-100",
    logoColorClass: "bg-emerald-600 shadow-emerald-100",
  },
  royal: {
    id: "royal",
    name: "Workspace Royal",
    desc: "The classic blue/indigo workspace aesthetic, polished and official",
    primary: "blue-600",
    primaryBg: "bg-blue-600",
    primaryHoverBg: "hover:bg-blue-700",
    primaryText: "text-blue-600",
    primaryHoverText: "hover:text-blue-750",
    primaryBgLight: "bg-blue-50/70",
    primaryBgLightHover: "hover:bg-blue-100/80",
    primaryBorderLight: "border-blue-100",
    primaryRing: "focus:ring-blue-500",
    shadowAccent: "shadow-blue-100",
    logoColorClass: "bg-blue-600 shadow-blue-100",
  },
  terracotta: {
    id: "terracotta",
    name: "Sunset Terracotta",
    desc: "An organic warm aesthetic utilizing terracotta clay and sunset amber tones",
    primary: "amber-600",
    primaryBg: "bg-amber-600",
    primaryHoverBg: "hover:bg-amber-700",
    primaryText: "text-amber-600",
    primaryHoverText: "hover:text-amber-750",
    primaryBgLight: "bg-amber-50/70",
    primaryBgLightHover: "hover:bg-amber-100/80",
    primaryBorderLight: "border-amber-100",
    primaryRing: "focus:ring-amber-500",
    shadowAccent: "shadow-amber-100",
    logoColorClass: "bg-amber-600 shadow-amber-100",
  },
  orange: {
    id: "orange",
    name: "Classic Orange",
    desc: "A bright, high-energy orange accent representing drive and communication",
    primary: "orange-600",
    primaryBg: "bg-orange-600",
    primaryHoverBg: "hover:bg-orange-700",
    primaryText: "text-orange-600",
    primaryHoverText: "hover:text-orange-750",
    primaryBgLight: "bg-orange-50/70",
    primaryBgLightHover: "hover:bg-orange-100/80",
    primaryBorderLight: "border-orange-100",
    primaryRing: "focus:ring-orange-500",
    shadowAccent: "shadow-orange-100",
    logoColorClass: "bg-orange-600 shadow-orange-100",
  },
  charcoal: {
    id: "charcoal",
    name: "Deep Charcoal",
    desc: "A highly sophisticated modern tech look featuring sleek neutral hues",
    primary: "slate-800",
    primaryBg: "bg-slate-800",
    primaryHoverBg: "hover:bg-slate-900",
    primaryText: "text-slate-800",
    primaryHoverText: "hover:text-slate-950",
    primaryBgLight: "bg-slate-100/70",
    primaryBgLightHover: "hover:bg-slate-200/80",
    primaryBorderLight: "border-slate-200",
    primaryRing: "focus:ring-slate-800",
    shadowAccent: "shadow-slate-100",
    logoColorClass: "bg-slate-800 shadow-slate-200",
  },
};

// Global Context or hook helper can let children component retrieve active colors easily.
