import "./node_modules/@mcpher/gas-fakes/main.js";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp as initAdminApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables (.env)
dotenv.config();

// Define CLI Usage
function printUsage() {
  console.log(`
\x1b[36mGoogle Slides Importing Utility (gas-fakes standalone App)\x1b[0m
===========================================================
This utility extracts contributor profiles from a Google Slides presentation
and saves them directly to your Firestore directory database.

\x1b[33mUsage:\x1b[0m
  npx tsx import-slides.ts <presentationId-or-URL>

\x1b[33mEnvironment Variables needed (in .env):\x1b[0m
  GEMINI_API_KEY        - Your Google Gemini API Key
  GOOGLE_ACCESS_TOKEN   - (Optional) OAuth access token with "presentations.readonly" scope.
                          If not provided, the script uses Application Default Credentials (ADC).

\x1b[33mExample:\x1b[0m
  npx tsx import-slides.ts 1234abcd-presentation-id-from-google-slides
  - or -
  npx tsx import-slides.ts https://docs.google.com/presentation/d/1234abcd-presentation-id-from-google-slides/edit
`);
}

// Extract presentation ID from url or parameter
function extractPresentationId(arg: string): string {
  if (!arg) return "";
  if (arg.startsWith("http://") || arg.startsWith("https://")) {
    const match = arg.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return arg;
}

async function fetchSlideThumbnail(presentationId: string, slideId: string): Promise<string | null> {
  try {
    const slidesGlobal = (globalThis as any).Slides;
    const urlFetchAppGlobal = (globalThis as any).UrlFetchApp;
    const utilitiesGlobal = (globalThis as any).Utilities;
    
    if (!slidesGlobal || !urlFetchAppGlobal || !utilitiesGlobal) {
      console.warn("  ⚠️ Required gas-fakes globals (Slides, UrlFetchApp, Utilities) are not fully available in globalThis.");
      return null;
    }
    
    console.log(`  🔍 Querying Advanced Slides API for slide "${slideId}" thumbnail...`);
    const thumb = slidesGlobal.Presentations.Pages.getThumbnail(presentationId, slideId, {
      "thumbnailProperties.thumbnailSize": "LARGE"
    });
    
    if (thumb && thumb.contentUrl) {
      console.log(`  🌐 Downloading slide snapshot image via UrlFetchApp...`);
      const response = urlFetchAppGlobal.fetch(thumb.contentUrl);
      const blob = response.getBlob();
      const base64 = utilitiesGlobal.base64Encode(blob.getBytes());
      const contentType = blob.getContentType() || "image/png";
      return `data:${contentType};base64,${base64}`;
    } else {
      console.warn("  ⚠️ Slides API returned a thumbnail without a contentUrl.");
    }
  } catch (err: any) {
    console.warn(`  ⚠️ Slides thumbnail fetch failed: ${err.message || err}`);
  }
  return null;
}

async function main() {
  const targetArg = process.argv[2];
  if (!targetArg || targetArg === "--help" || targetArg === "-h") {
    printUsage();
    process.exit(0);
  }

  const presentationId = extractPresentationId(targetArg);
  if (!presentationId) {
    console.error("\x1b[31mError: No presentation ID or URL was supplied.\x1b[0m");
    printUsage();
    process.exit(1);
  }

  console.log(`\x1b[34m[1/4] Connecting to Google Slides (ID: ${presentationId})...\x1b[0m`);

  // 1. Setup Auth and Sandbox bypass for gas-fakes
  const slidesAppGlobal = (globalThis as any).SlidesApp;
  const scriptAppGlobal = (globalThis as any).ScriptApp;

  if (!slidesAppGlobal) {
    console.error("\x1b[31mError: Failed to initialize gas-fakes SlidesApp global.\x1b[0m");
    process.exit(1);
  }

  // Ensure Slides advanced service has Pages sub-resource patched
  try {
    const slidesGlobal = (globalThis as any).Slides;
    if (slidesGlobal && slidesGlobal.Presentations) {
      const presentationsProto = Object.getPrototypeOf(slidesGlobal.Presentations);
      if (presentationsProto && !presentationsProto.Pages) {
        console.log("  🩹 Patching gas-fakes Slides advanced service with Presentations.Pages support...");
        Object.defineProperty(presentationsProto, "Pages", {
          get() {
            const self = this;
            return {
              getThumbnail(presentationId: string, pageObjectId: string, optionalArgs?: any) {
                const params = {
                  presentationId,
                  pageObjectId,
                  ...optionalArgs
                };
                const result = self._call('getThumbnail', params, {}, 'pages');
                if (result && result.response && result.response.status !== 200) {
                  const err = result.response.error || {};
                  throw new Error(err.message || result.response.statusText || "Unknown error");
                }
                return result.data;
              }
            };
          },
          enumerable: true,
          configurable: true
        });
      }
    }
  } catch (err: any) {
    console.warn("  ⚠️ Failed to patch Slides advanced service:", err.message || err);
  }

  // Set Google OAuth Access Token if supplied
  const token = (globalThis as any).ScriptApp.getOAuthToken();


  // Helper arrays for slides text
  const extractedSlides: { text: string; index: number }[] = [];
  const slideIdMap: { [key: number]: string } = {};

  try {
    // 2. Load Presentation and Slide text
    const presentation = slidesAppGlobal.openById(presentationId);
    const title = presentation.getName();
    console.log(`\x1b[32m✔ Successfully opened presentation: "${title}"\x1b[0m`);

    const slidesList = presentation.getSlides();
    console.log(`Found ${slidesList.length} slide pages in presentation.`);

    slidesList.forEach((slide: any, i: number) => {
      const slideIndex = i + 1;
      try {
        const slideId = slide.getObjectId();
        slideIdMap[slideIndex] = slideId;
      } catch (err: any) {
        console.warn(`Could not get slide ID for index ${slideIndex}:`, err.message || err);
      }
      const elements = slide.getPageElements();
      let slideText = "";

      for (const element of elements) {
        if (element.getPageElementType().toString() === "SHAPE") {
          try {
            const rawText = element.asShape().getText().asString();
            if (rawText && rawText.trim()) {
              slideText += rawText + "\n";
            }
          } catch (shapeError) {
            // Safe fallback
          }
        }
      }

      let trimmedText = slideText.trim();
      if (trimmedText) {
        // Truncate extremely verbose slide text just in case to avoid JSON overflow or massive responses
        if (trimmedText.length > 8000) {
          console.warn(`\x1b[33m   ⚠️ Slide ${i + 1} has unusually large text content (${trimmedText.length} chars). Truncating to 8000 chars to avoid model/JSON limits...\x1b[0m`);
          trimmedText = trimmedText.slice(0, 8000) + "\n... [truncated due to extreme length] ...";
        }
        extractedSlides.push({
          index: i + 1,
          text: trimmedText
        });
      }
    });

    console.log(`\x1b[32m✔ Extracted valid text content from ${extractedSlides.length} slide pages.\x1b[0m`);
  } catch (slidesError: any) {
    console.error(`\x1b[31mError accessing Google Slides via gas-fakes:\x1b[0m`, slidesError.message || slidesError);
    console.error("Please ensure that:");
    console.error("  1. The presentation is public or shared with your authenticated credentials.");
    console.error("  2. You have authenticated with the required slides read scope.");
    process.exit(1);
  }

  if (extractedSlides.length === 0) {
    console.error("\x1b[31mError: No readable text found in any of the slides shape elements.\x1b[0m");
    process.exit(1);
  }

  // 3. Connect to Gemini for extraction
  console.log(`\x1b[34m[2/4] Initializing Gemini and parsing structured contributor details...\x1b[0m`);
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    console.error("\x1b[31mError: GEMINI_API_KEY environment variable is missing from .env\x1b[0m");
    process.exit(1);
  }

  const ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  let parsedContributors: any[] = [];
  const cacheFilePath = path.resolve("./slides-cache.json");
  let loadedFromCache = false;

  if (fs.existsSync(cacheFilePath)) {
    try {
      console.log(`\x1b[32m✔ Found local cache file 'slides-cache.json'. Loading profiles directly from cache to bypass Gemini processing...\x1b[0m`);
      console.log(`  (To re-run slide extraction and Gemini parsing, delete or rename 'slides-cache.json')`);
      const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, "utf8"));
      if (Array.isArray(cachedData) && cachedData.length > 0) {
        parsedContributors = cachedData;
        loadedFromCache = true;
        console.log(`\x1b[32m✔ Successfully loaded ${parsedContributors.length} profile(s) from cache.\x1b[0m`);
      } else {
        console.warn(`⚠️ Cache file is empty or not an array, falling back to Gemini parsing.`);
      }
    } catch (cacheError: any) {
      console.warn(`⚠️ Failed to parse slides-cache.json, falling back to Gemini parsing:`, cacheError.message || cacheError);
    }
  }

  // Helper function to extract structured fields using Gemini.
  async function parseSlidesWithGemini(slidesSubList: { text: string; index: number }[]): Promise<any[]> {
    const compiledText = slidesSubList
      .map((s) => `[SLIDE ${s.index}]\n${s.text}`)
      .join("\n\n---\n\n");

    const prompt = `You are a structured data extractor. You are given the text extracted from individual pages/slides of a presentation directory.
Extract and return a list of contributors found in these slides.
Each entry in the list MUST represent a contributor.
Only extract slide pages that clearly contain contributor profiles or details (if a slide is just a cover, header, empty, or table of contents, ignore it).

Text from slides:
${compiledText}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Extract detailed contributor/consultant profiles. Even if a slide has minimal info (like just a name, title, or skills without contact info), extract it as a profile. Ensure the name is strictly populated. Determine which [SLIDE index] header the profile text is located under, and set the slideIndex field to that 1-based integer index. Extract LinkedIn, GitHub, Twitter, Website URLs and any phone numbers (and formats) if present in the text. For skills, split any comma-separated or list-like skill bullet points into individual strings. Filter and normalize emails, but if no email is found, omit the email field (it is not required). Keep bios and slideNotes extremely concise (strictly under 350 characters each) to prevent JSON buffer or truncation errors.",
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
              bio: { type: Type.STRING, description: "Brief background, biography, or general intro text. Limit to 350 characters." },
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Recognized skills, languages, tools, or expertises"
              },
              github: { type: Type.STRING, description: "GitHub profile link or username" },
              linkedin: { type: Type.STRING, description: "LinkedIn profile link or username" },
              twitter: { type: Type.STRING, description: "Twitter/X profile link" },
              website: { type: Type.STRING, description: "Personal or professional website URL" },
              phone: { type: Type.STRING, description: "Phone number of the contributor if found in the text" },
              company: { type: Type.STRING, description: "Company name, employer, or organization they are associated with (found on slide)" },
              slideNotes: { type: Type.STRING, description: "Any other descriptive text, extra achievements, slide-specific annotations or background notes extracted from the slide. Limit to 350 characters." },
              slideIndex: { type: Type.INTEGER, description: "The 1-based integer index of the slide where this contributor profile text was found (e.g. 3 for [SLIDE 3])." }
            },
            required: ["name"]
          }
        }
      }
    });

    const parsedText = response.text || "[]";
    const batchContributors = JSON.parse(parsedText);
    return Array.isArray(batchContributors) ? batchContributors : [];
  }

  const BATCH_SIZE = 2;
  const MAX_SLIDES = null; // Process all slides
  const doSlides = extractedSlides.slice(0, MAX_SLIDES || Infinity)

  if (!loadedFromCache) {
    console.log(`Starting batched processing. Grouping ${doSlides.length} slides into batches of ${BATCH_SIZE} to ensure reliable JSON parsing...`);

    for (let idx = 0; idx < doSlides.length; idx += BATCH_SIZE) {
      const batch = doSlides.slice(idx, idx + BATCH_SIZE);
      const startSlide = batch[0].index;
      const endSlide = batch[batch.length - 1].index;
      
      console.log(`\x1b[34m -> Parsing batch slides [${startSlide} - ${endSlide}] (${batch.length} slides)...\x1b[0m`);

      try {
        const batchContributors = await parseSlidesWithGemini(batch);
        console.log(`\x1b[32m   ✔ Found ${batchContributors.length} contributor profile(s) in this batch.\x1b[0m`);
        
        // Ensure slideIndex is correctly set for each contributor in the batch!
        for (const c of batchContributors) {
          if (typeof c.slideIndex !== "number" || isNaN(c.slideIndex)) {
            if (batch.length === 1) {
              c.slideIndex = batch[0].index;
            } else {
              // Look for name match in slides text to assign correct slide index, otherwise default to first slide
              const foundSlide = batch.find(s => s.text.toLowerCase().includes((c.name || "").toLowerCase()));
              c.slideIndex = foundSlide ? foundSlide.index : batch[0].index;
            }
          }
        }
        
        parsedContributors.push(...batchContributors);
      } catch (geminiError: any) {
        console.warn(`\x1b[33m   ⚠️ Batch parsing [${startSlide} - ${endSlide}] failed with: ${geminiError.message || geminiError}\x1b[0m`);
        console.log(`   Retrying slides in batch [${startSlide} - ${endSlide}] one by one to isolate and parse individually...`);

        for (const singleSlide of batch) {
          console.log(`     -> Parsing slide ${singleSlide.index} individually...`);
          try {
            const singleContributors = await parseSlidesWithGemini([singleSlide]);
            if (singleContributors.length > 0) {
              for (const c of singleContributors) {
                if (typeof c.slideIndex !== "number" || isNaN(c.slideIndex)) {
                  c.slideIndex = singleSlide.index;
                }
              }
              console.log(`\x1b[32m       ✔ Found ${singleContributors.length} contributor profile(s) in slide ${singleSlide.index}.\x1b[0m`);
              parsedContributors.push(...singleContributors);
            } else {
              console.log(`       No profile found in slide ${singleSlide.index}.`);
            }
          } catch (individualError: any) {
            console.error(`\x1b[31m       ❌ Failed to parse slide ${singleSlide.index}: ${individualError.message || individualError}\x1b[0m`);
          }
        }
      }
    }

    console.log(`\x1b[32m✔ Batch processing finished. Gemini extracted a total of ${parsedContributors.length} contributor profile(s).\x1b[0m`);

    // Save extracted profiles to local cache file
    try {
      fs.writeFileSync(cacheFilePath, JSON.stringify(parsedContributors, null, 2), "utf8");
      console.log(`\x1b[32m✔ Saved extracted profiles to local cache file 'slides-cache.json' to prevent re-running Gemini in future executions.\x1b[0m`);
    } catch (cacheWriteErr: any) {
      console.warn(`⚠️ Failed to write slides-cache.json:`, cacheWriteErr.message || cacheWriteErr);
    }
  }

  if (parsedContributors.length === 0) {
    console.log("No valid contributor records were found in the slides content.");
    process.exit(0);
  }

  // 4. Initialize Firebase and Store results
  console.log(`\x1b[34m[3/4] Connecting to Firestore database (using Admin SDK)...\x1b[0m`);
  const configPath = path.resolve("./firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.error(`\x1b[31mError: firebase-applet-config.json not found at ${configPath}\x1b[0m`);
    process.exit(1);
  }

  let db: any;
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const adminApp = initAdminApp({
      projectId: firebaseConfig.projectId,
    });
    db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
      ? getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId)
      : getAdminFirestore(adminApp);
    console.log(`...connected to project: "${firebaseConfig.projectId}" via Admin SDK`);
  } catch (firebaseInitError: any) {
    console.error(`\x1b[31mError initializing Firebase Admin:\x1b[0m`, firebaseInitError.message || firebaseInitError);
    process.exit(1);
  }

  console.log(`\x1b[34m[3.5/4] Fetching existing records from Firestore to minimize reads...\x1b[0m`);
  const existingMap = new Map<string, any>();
  try {
    const querySnapshot = await db.collection("contributors").get();
    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data && data.email) {
        existingMap.set(data.email.toLowerCase().trim(), {
          ref: doc.ref,
          data: data
        });
      }
    });
    console.log(`...successfully cached ${existingMap.size} existing profiles in memory.`);
  } catch (fetchError: any) {
    console.warn(`⚠️ Failed to cache existing profiles, will fallback to individual queries:`, fetchError.message || fetchError);
  }

  console.log(`\x1b[34m[3.8/4] Deduplicating contributor profiles in memory to prevent duplicate processing...\x1b[0m`);
  
  // Deduplicate contributors by email to avoid duplicate processing and DB operations
  const uniqueContributorsMap = new Map<string, any>();
  for (const contrib of parsedContributors) {
    const tempSlideIndex = typeof contrib.slideIndex === "number" ? contrib.slideIndex : 1;
    let email = (contrib.email || "").toLowerCase().trim();
    if (!email) {
      const slug = (contrib.name || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "");
      email = `no-email-${slug || "consultant"}-${tempSlideIndex}@example.com`;
    }
    
    if (!uniqueContributorsMap.has(email)) {
      uniqueContributorsMap.set(email, { ...contrib, email });
    } else {
      // Merge properties if duplicate is found: merge skills, keep the one with more details
      const existing = uniqueContributorsMap.get(email);
      const combinedSkills = Array.from(new Set([
        ...(Array.isArray(existing.skills) ? existing.skills : []),
        ...(Array.isArray(contrib.skills) ? contrib.skills : [])
      ]));
      
      const merged: any = { ...existing };
      for (const key of Object.keys(contrib)) {
        if (key === "skills") continue;
        const val = contrib[key];
        const extVal = existing[key];
        
        if (key === "slideIndex") {
          // Keep slideIndex that is not 1 if one is 1 and other is not
          const existingIndex = typeof extVal === "number" ? extVal : 1;
          const newIndex = typeof val === "number" ? val : 1;
          merged.slideIndex = existingIndex !== 1 ? existingIndex : newIndex;
        } else {
          const valStr = val !== undefined && val !== null ? String(val).trim() : "";
          const extValStr = extVal !== undefined && extVal !== null ? String(extVal).trim() : "";
          
          if (extValStr && (!valStr || valStr.length < extValStr.length)) {
            // Keep existing (more detailed) value
          } else if (val !== undefined && val !== null) {
            merged[key] = val;
          }
        }
      }
      merged.email = email;
      merged.skills = combinedSkills;
      uniqueContributorsMap.set(email, merged);
    }
  }
  
  const uniqueContributors = Array.from(uniqueContributorsMap.values());
  console.log(`  ✔ Deduplicated parsed list from ${parsedContributors.length} down to ${uniqueContributors.length} unique profiles.`);

  console.log(`\x1b[34m[4/4] Writing profiles to Firestore contributors collection...\x1b[0m`);
  let successCount = 0;
  const thumbnailCache = new Map<string, string | null>();

  for (const contrib of uniqueContributors) {
    try {
      const tempSlideIndex = typeof contrib.slideIndex === "number" ? contrib.slideIndex : 1;
      const lookupEmail = contrib.email.toLowerCase().trim();
      const existing = existingMap.get(lookupEmail);
      let docRef;
      let existingRecord: any = null;
      let isUpdate = false;

      if (existing) {
        docRef = existing.ref;
        existingRecord = existing.data;
        isUpdate = true;
      } else {
        docRef = db.collection("contributors").doc();
      }

      const docId = docRef.id;

      const targetSlideIndex = typeof contrib.slideIndex === "number" ? contrib.slideIndex : (existingRecord?.slideIndex || 1);

      // Fetch the actual slide thumbnail image if possible
      const slideObjectId = slideIdMap[targetSlideIndex];
      let slideSnapshotUrl: string | null = null;
      if (slideObjectId) {
        if (thumbnailCache.has(slideObjectId)) {
          slideSnapshotUrl = thumbnailCache.get(slideObjectId)!;
          console.log(`  ℹ️ Re-using cached thumbnail for slide index ${targetSlideIndex} (${slideObjectId})`);
        } else {
          slideSnapshotUrl = await fetchSlideThumbnail(presentationId, slideObjectId);
          thumbnailCache.set(slideObjectId, slideSnapshotUrl);
        }
      }

      // Maintain user's additional portfolio images if they exist.
      // We don't generate fake SVG thumbnails. If we don't have a thumbnail, we don't put a dummy image.
      let finalImages: string[] = [];
      if (slideSnapshotUrl) {
        finalImages.push(slideSnapshotUrl);
      }
      if (existingRecord?.images && existingRecord.images.length > 0) {
        if (slideSnapshotUrl) {
          // Replace the first (previous thumbnail) with the new thumbnail, and keep the rest of the portfolio
          finalImages = [slideSnapshotUrl, ...existingRecord.images.slice(1)];
        } else {
          // Keep the existing ones
          finalImages = [...existingRecord.images];
        }
      }

      const fullRecord = {
        id: docId,
        name: contrib.name || existingRecord?.name || "Unknown Name",
        email: contrib.email,
        role: contrib.role || existingRecord?.role || "Contributor",
        bio: contrib.bio || existingRecord?.bio || "",
        skills: Array.isArray(contrib.skills) ? contrib.skills : (existingRecord?.skills || []),
        github: contrib.github || existingRecord?.github || "",
        linkedin: contrib.linkedin || existingRecord?.linkedin || "",
        twitter: contrib.twitter || existingRecord?.twitter || "",
        website: contrib.website || existingRecord?.website || "",
        company: contrib.company || existingRecord?.company || "",
        phone: contrib.phone || existingRecord?.phone || "",
        slideNotes: contrib.slideNotes || existingRecord?.slideNotes || "",
        slideIndex: targetSlideIndex,
        images: finalImages,
        badges: Array.from(new Set(["pioneer", ...(existingRecord?.badges || [])])),
        // Preserve user ownership & approval states
        status: existingRecord?.status || "approved",
        systemRole: existingRecord?.systemRole || "contributor",
        userId: existingRecord?.userId || null,
        createdAt: existingRecord?.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      await docRef.set(fullRecord);

      // Keep local cache updated
      existingMap.set(lookupEmail, {
        ref: docRef,
        data: fullRecord
      });

      if (isUpdate) {
        console.log(`  ~ Updated existing contributor: \x1b[32m${fullRecord.name}\x1b[0m (${fullRecord.email}) [Preserved claim/approval state]`);
      } else {
        console.log(`  + Imported contributor: \x1b[32m${fullRecord.name}\x1b[0m (${fullRecord.email})`);
      }
      successCount++;
    } catch (saveError: any) {
      console.error(`  - Failed to save profile for ${contrib.name || "Unknown"}:`, saveError.message || saveError);
    }
  }

  console.log(`
\x1b[32m===========================================================
✔ Standalone Import Completed successfully!
===========================================================\x1b[0m
  * Total Slides Read: ${extractedSlides.length}
  * Total Slides Procrssed ${doSlides.length}
  * Contributors Found: ${parsedContributors.length}
  * Successfully Imported to Firestore: ${successCount}

Thank you! You can now check your standard slide directory app to see the newly imported profiles!
`);
}

main().catch((error) => {
  console.error("Unhandle fatal script error:", error);
  process.exit(1);
});
