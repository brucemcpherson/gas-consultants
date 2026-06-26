/**
 * Shared Type Definitions for Slide Directory
 */

export interface AdditionalLink {
  label: string;
  url: string;
}

export interface Contributor {
  id: string; // Document key / unique identifier
  name: string;
  email: string;
  role: string;
  bio: string;
  skills: string[];
  github?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
  company?: string;
  phone?: string;
  slideNotes?: string;
  status: "pending" | "approved";
  systemRole?: "contributor" | "admin";
  slideIndex?: number;
  userId?: string | null; // the owner user uid if claimed
  avatarUrl?: string; // profile picture (base64 or URL)
  hidden?: boolean; // administrative hidden state
  flagged?: boolean; // whether the profile has been reported
  flagCount?: number; // count of reports
  flaggedReasons?: string[]; // list of report reasons
  shareEmail?: boolean; // toggle to control public display of email
  images?: string[]; // array of additional images or slide snapshots
  badges?: string[]; // badges properties for members (e.g. "pioneer")
  additionalLinks?: AdditionalLink[]; // custom clickable portfolio/other links
  createdAt?: any;
  updatedAt?: any;
}

export interface DirectMessage {
  id: string;
  contributorId: string;
  contributorEmail: string;
  contributorUserId: string; // To query secure lists O(1)
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export interface AdminUser {
  id: string;
  email: string;
  createdAt: any;
}
