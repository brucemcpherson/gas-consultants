# Consultant Directory

An elegant, highly optimized directory application designed to organize, search, and manage professional consultant profiles. The directory is populated directly from Google Slides presentations using an AI-assisted parsing pipeline and offers real-time editing, secure ownership verification, and robust administrative management.

## 🚀 Key Capabilities

### 1. Slide Ingestion & Data Pipeline (`import-slides.ts`)
*   **Gemini-Powered Extraction**: Automatically processes Google Slides decks using the Google GenAI SDK to extract detailed biographies, contact emails, social links, and key skills.
*   **Intelligent Deduplication**: Merges duplicate entries from original decks, retaining the most descriptive records, consolidating skills, and assigning consistent slide indexing.
*   **Performance Caching**: Employs a local JSON cache (`slides-cache.json`) for slide representations and a memory-based cache for slide thumbnail queries to optimize performance and control API costs.

### 2. Contributor Directory UI (React + Tailwind CSS)
*   **Dynamic Searching & Filtering**: Highly responsive search index filtering contributors instantly by name, biography, or specific skill tags.
*   **Media Gallery Carousels**: Displays extracted presentation slides and custom consultant-uploaded screenshots side-by-side in a responsive visual viewport.
*   **Custom Portfolio Linking**: Supports rich, interactive custom hyperlinks (with normalized protocol resolution) so consultants can highlight external project portfolios.

### 3. Role-Based Access Control (RBAC) & Firestore Rules
*   **Verified Ownership**: Contributors can register, claim their unowned profiles using their Google Sign-In email, and securely update their personal information or visibility.
*   **Administrative Oversight**: Administrators have unrestricted, system-wide clearance to edit, update, approve, hide, or delete any profile directly from the directory interface.
*   **Strict Database Guardrails (`firestore.rules`)**: Enforces validation of schema rules in Firestore, securing profiles so only verified owners or system administrators can write, while preserving public search permissions.

## 🛠️ Tech Stack
*   **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Motion (Framer Motion)
*   **Backend**: Node.js, Express (custom container runner)
*   **Database & Auth**: Google Cloud Firestore, Firebase Authentication
*   **AI Integration**: Google GenAI SDK (`@google/genai`)


[Original source slides - Apps Script Consultants Directory](https://docs.google.com/presentation/d/1U1y6Vjf5ClEof15JLw4qg7tpjpo4MHk7uhVKpjVkA9M/edit?usp=sharing)

Ingestion powered by [gas-fakes](https://github.com/brucemcpherson/gas-fakes)