import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp as initAdminApp, getApps as getAdminApps, getApp as getAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import fs from "fs";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Firebase Admin SDK
let adminApp;
let adminDb: any = null;
const configPath = path.resolve("./firebase-applet-config.json");

try {
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (getAdminApps().length === 0) {
      adminApp = initAdminApp({
        projectId: firebaseConfig.projectId,
      });
    } else {
      adminApp = getAdminApp();
    }
    adminDb = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
      ? getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
      : getAdminFirestore(adminApp);
    console.log(`Firebase Admin initialized successfully for project: ${firebaseConfig.projectId}`);
  } else {
    console.warn("[Firebase Admin Warning] firebase-applet-config.json not found.");
  }
} catch (adminInitError) {
  console.error("Failed to initialize Firebase Admin SDK:", adminInitError);
}

// Mailer Helper Function
async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  const isSmtpConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );

  if (isSmtpConfigured) {
    console.log(`Attempting to send real email to ${to} using SMTP...`);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    try {
      await transporter.sendMail({
        from: `Contributor Directory <${process.env.SMTP_USER}>`,
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ""),
        html,
      });
      return { success: true, method: "SMTP" };
    } catch (err: any) {
      console.error("Failed to send email via SMTP:", err);
    }
  }

  // Fallback dev simulation
  console.log("\n=======================================================");
  console.log(`[EMAIL DEVELOPMENT FALLBACK]`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Content:\n${text || html.replace(/<[^>]*>/g, "")}`);
  console.log("=======================================================\n");

  const otpMatch = text?.match(/\b\d{6}\b/) || html.match(/\b\d{6}\b/);
  return {
    success: true,
    method: "Development Fallback (Console Log)",
    notice: "Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS variables in your secrets panel to enable real mail deliveries.",
    otpCode: otpMatch ? otpMatch[0] : undefined
  };
}

// Body parser
app.use(express.json({ limit: "15mb" }));

// Shared Gemini Client
// We set the User-Agent header to 'aistudio-build' in httpOptions for telemetry.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// AI Parse API endpoint
app.post("/api/parse-slides", async (req, res) => {
  try {
    const { slides } = req.body; // array of { text: string, index: number }
    if (!slides || !Array.isArray(slides)) {
      return res.status(400).json({ error: "Invalid slides payload" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Gemini API Key is not configured." });
    }

    const compiledText = slides
      .map((s) => `[SLIDE ${s.index}]\n${s.text}`)
      .join("\n\n---\n\n");

    const prompt = `You are a structured data extractor. You are given the text extracted from individual pages/slides of a presentation directory.
Extract and return a list of contributors.
Each entry in the list MUST represent a contributor.
Only extract slide pages that clearly contain contributor profiles or details (if a slide is just a cover, header, empty, or table of contents, ignore it).

Text from slides:
${compiledText}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Extract detailed contributor profiles. Ensure fields are strictly populated. Extract LinkedIn, GitHub, Twitter and Website URLs if present in the text. For skills, split any comma-separated or list-like skill bullet points into individual strings. Filter and normalize emails.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of parsed contributors found in the slides",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the contributor" },
              email: { type: Type.STRING, description: "Contact email of the contributor" },
              role: { type: Type.STRING, description: "Current role, title, or job description" },
              bio: { type: Type.STRING, description: "Brief background, biography, or general intro text" },
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Recognized skills, languages, tools, or expertises"
              },
              github: { type: Type.STRING, description: "GitHub profile link or username" },
              linkedin: { type: Type.STRING, description: "LinkedIn profile link or username" },
              twitter: { type: Type.STRING, description: "Twitter/X profile link" },
              website: { type: Type.STRING, description: "Personal or professional website URL" }
            },
            required: ["name", "email"]
          }
        }
      }
    });

    const parsedText = response.text || "[]";
    const parsedData = JSON.parse(parsedText);
    return res.json({ contributors: parsedData });
  } catch (error: any) {
    console.error("Gemini Parse Slides Error:", error);
    return res.status(500).json({ error: error.message || "Failed to parse slides" });
  }
});

// --- Claim Profile: Send Code ---
app.post("/api/claim/send-code", async (req, res) => {
  try {
    const { email, contributorId } = req.body;
    if (!email || !contributorId) {
      return res.status(400).json({ error: "Missing required fields: email and contributorId" });
    }

    if (!adminDb) {
      return res.status(500).json({ error: "Firestore Database Admin integration is not configured." });
    }

    const cleanEmail = email.toLowerCase().trim();
    // Generate a 6-digit confirmation code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Get the contributor's name if we can
    const contribRef = adminDb.collection("contributors").doc(contributorId);
    const contribDoc = await contribRef.get();
    const contribName = contribDoc.exists ? contribDoc.data().name : "Contributor";

    // Store in adminDb
    await adminDb.collection("verification_codes").doc(cleanEmail).set({
      code: otpCode,
      contributorId,
      expiresAt: expiresAt,
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Claim Your Profile</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.5;">Hello ${contribName},</p>
        <p style="color: #475569; font-size: 16px; line-height: 1.5;">You have requested to claim a contributor profile on our platform with the email address <b>${cleanEmail}</b>.</p>
        <p style="color: #475569; font-size: 16px; line-height: 1.5;">To verify that you own this email address, please enter the following 6-digit verification code in the claim form:</p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2563eb; letter-spacing: 5px; font-size: 36px; margin: 0; font-family: 'Courier New', monospace;">${otpCode}</h1>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code was sent securely. It will expire in 10 minutes.</p>
      </div>
    `;

    const mailResult = await sendEmail({
      to: cleanEmail,
      subject: `${otpCode} is your verification code to claim your profile`,
      html: emailHtml,
      text: `Hello ${contribName},\n\nYou have requested to claim your contributor profile with the email address ${cleanEmail}. To verify your ownership, please use the following 6-digit verification code:\n\n${otpCode}\n\nThis code will expire in 10 minutes.`
    });

    return res.json({
      success: true,
      notice: mailResult.notice || null,
      otpCodeFallback: mailResult.otpCode
    });
  } catch (error: any) {
    console.error("claim/send-code error:", error);
    return res.status(500).json({ error: error.message || "Failed to send verification code" });
  }
});

// --- Claim Profile: Verify Code & Update Profile ---
app.post("/api/claim/verify-code", async (req, res) => {
  try {
    const { email, code, contributorId, userId } = req.body;
    if (!email || !code || !contributorId || !userId) {
      return res.status(400).json({ error: "Missing required fields: email, code, contributorId, and userId" });
    }

    if (!adminDb) {
      return res.status(500).json({ error: "Firestore Database Admin integration is not configured." });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Fetch the verification code doc
    const valDocRef = adminDb.collection("verification_codes").doc(cleanEmail);
    const valDoc = await valDocRef.get();

    if (!valDoc.exists) {
      return res.status(400).json({ error: "No verification request found for this email. Please request a new code." });
    }

    const valData = valDoc.data();

    // Verify code
    if (valData.code !== code.trim()) {
      return res.status(400).json({ error: "Invalid verification code. Please check and try again." });
    }

    // Verify contributor match
    if (valData.contributorId !== contributorId) {
      return res.status(400).json({ error: "Profile mismatch error." });
    }

    // Verify expiration
    const expiryDate = valData.expiresAt.toDate();
    if (Date.now() > expiryDate.getTime()) {
      await valDocRef.delete(); // cleanup
      return res.status(400).json({ error: "This verification code has expired. Please request a new one." });
    }

    // code is valid! Modify contributor document
    const contribRef = adminDb.collection("contributors").doc(contributorId);
    const contribDoc = await contribRef.get();
    if (!contribDoc.exists) {
      return res.status(404).json({ error: "The profile you are trying to claim does not exist." });
    }

    const currentData = contribDoc.data();
    if (currentData.userId && currentData.userId !== userId) {
      return res.status(403).json({ error: "This profile has already been claimed by another user." });
    }

    // Save the user UID and verified email to the profile!
    await contribRef.update({
      userId: userId,
      email: cleanEmail,
      updatedAt: new Date()
    });

    // Cleanup code
    await valDocRef.delete();

    return res.json({ success: true, message: "Profile claimed successfully!" });
  } catch (error: any) {
    console.error("claim/verify-code error:", error);
    return res.status(500).json({ error: error.message || "Failed to verify claims" });
  }
});

// --- Claim Profile: Notify and Claim ---
app.post("/api/claim/notify-and-claim", async (req, res) => {
  try {
    const { contributorId, claimantUid, claimantName, claimantEmail } = req.body;
    if (!contributorId || !claimantUid || !claimantName || !claimantEmail) {
      return res.status(400).json({ error: "Missing required claim details" });
    }

    if (!adminDb) {
      return res.status(500).json({ error: "Firestore Database Admin integration is not configured." });
    }

    const contribRef = adminDb.collection("contributors").doc(contributorId);
    const contribDoc = await contribRef.get();
    if (!contribDoc.exists) {
      return res.status(404).json({ error: "Contributor profile not found" });
    }

    const currentData = contribDoc.data();
    if (currentData.userId && currentData.userId !== claimantUid) {
      return res.status(403).json({ error: "This profile has already been claimed by another user." });
    }

    if (!currentData.email) {
      return res.status(400).json({ error: "No email address registered for this profile. Use verification workflow instead." });
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Security Alert: Contributor Profile Claimed</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.5;">Hello ${currentData.name || 'Contributor'},</p>
        <p style="color: #475569; font-size: 16px; line-height: 1.5;">We are writing to inform you that your contributor profile has been claimed and linked to a Google Account:</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #0f172a;"><b>Claimant Name:</b> ${claimantName}</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #0f172a;"><b>Claimant Google Account:</b> ${claimantEmail}</p>
        </div>
        <p style="color: #475569; font-size: 16px; line-height: 1.5;">If this was you, you can now log in using your Google Account to update and manage your contributor card directly.</p>
        <p style="color: #ef4444; font-size: 14px; font-weight: bold;">If this was NOT you or you believe this action is fraudulent, please notify the directory administrator immediately.</p>
        <p style="color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 20px;">This is an automated security notification.</p>
      </div>
    `;

    const mailResult = await sendEmail({
      to: currentData.email,
      subject: `Security Notice: Your contributor profile has been claimed by ${claimantName}`,
      html: emailHtml,
      text: `Hello ${currentData.name || 'Contributor'},\n\nWe wanted to let you know that your contributor profile has been claimed and linked to a Google account:\n\nClaimant: ${claimantName} (${claimantEmail})\n\nIf this was you, you are ready to manage your profile. If this was not you, please notify the directory administrator immediately.`
    });

    // Update profile
    await contribRef.update({
      userId: claimantUid,
      updatedAt: new Date()
    });

    return res.json({
      success: true,
      message: "Notification sent and profile claimed successfully",
      notice: mailResult.notice || null
    });
  } catch (error: any) {
    console.error("claim/notify-and-claim error:", error);
    return res.status(500).json({ error: error.message || "Failed to notify and claim" });
  }
});

// Bootstrap function to support async/await without top-level compilation limits
async function bootstrap() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to host 0.0.0.0 and port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

bootstrap();
