# Apps Script Consultant Directory

An elegant, full-stack, responsive directory application to find, connect, and support Apps Script, Google Workspace, and Cloud Solutions Consultants. Powered by **React 19**, **Tailwind CSS v4**, and **Firebase Firestore/Auth**.

---

## 🎨 Aesthetic Features & Theme Strategy

- **Interactive Themes**: Choose between multiple polished color scheme presets, including Orange, Emerald (Apps Script/Sheets matching green), Royal, Sunset Terracotta, and Deep Charcoal.
- **Dark Mode**: Integrated a high-performance, smooth-transition Dark Mode. Toggle between Dark and Light mode instantly next to the palette picker.
- **Professional Typography**: Utilizes Inter font with carefully selected weights, generous margins, and a beautiful layout scale.
- **Responsive & Desktop-First**: Fully adaptive from single-screen smartphone views with mobile bottom sheets/navigation bars up to high-density ultra-wide desktop monitors.

---

## 🛠️ Functional Modules & Capabilities

- **Consultant Directory**: Filter consultants by their unique skills (D3, React, SQL, Apps Script, etc.) or perform natural language searches on bios.
- **Secure Authentication**: Official Google Sign-In fully integrated using Firebase Authentication.
- **My Profile Management**: Authenticated users can claim, edit, or customize their profiles.
  - **Dynamic Slide extraction info**: View contextual presenter slide summaries.
  - **Rich Fields with Live Preview**: Support for beautiful Markdown bios and slide notes, with active, dynamic live-preview buttons.
- **Direct Messaging Inbox**: Send secure, rich messages to consultants directly from their directory profiles.
- **Administrative Overrides**: Elevated admin roles can moderate profiles, view system logs, delete accounts, and edit status.

---

## 🚀 Release Notes (v1.2.0)

This version completes the full application dark mode transition, moving from a simple "dark background mode" to a completely styled, eye-safe **True Dark Mode** experience:

### 1. Unified Dark Components & True Card Surfaces
- **Deep Slate Surfaces**: Replaced remaining light-colored component backdrops (cards, modal contents, profile forms, report sheets) with rich `dark:bg-slate-905` and `dark:bg-slate-900` surfaces.
- **Form Input Harmony**: All search fields, skill tag inputs, checkboxes, textareas, and selection radios are fully adapted to `dark:bg-slate-950` with elegant `dark:border-slate-800` borders and white text.
- **Consistent Borders**: Applied delicate `dark:border-slate-800` and `dark:divide-slate-800` outlines across all grids, card footers, and dividers to preserve clean pixel lines in dark mode.

### 2. Upgraded Modal Overlays & Inbox Elements
- **Claim & Contact Modals**: Styled the steps, warning boxes, notices, and action elements in the admin/claim flow.
- **Inbox Messaging Center**: Upgraded the direct message sidebar and detailed message view pane in `MyInboxModal` with optimized unread markers, dark background lists, and reply overlays.
- **Report & Flag Modals**: All user-reported action boxes are styled to ensure high accessibility and elegant red/amber alert states.

---

## 🚀 Release Notes (v1.1.0)

This version introduces key usability, layout, and visual improvements:

### 1. Beautiful Dark Mode Integration
- Added a gorgeous, fully fluid dark mode toggle next to the top navigation swapper.
- Enhanced all modal components, text fields, inputs, cards, and side drawers with unified tailwind classes (`dark:bg-slate-900`, `dark:text-slate-100`, etc.) for seamless day/night contrast.
- Uses standard HTML `color-scheme: dark` to style browser native components (scrollbars, selection highlights, date fields, dropdown selectors).

### 2. High-Performance Markdown Rendering & Link Normalization
- **Standardizing Extracted Links**: Fixed broken slide extraction link structures (e.g. standardizing non-standard brackets and layouts `[text] (url]` or `[text] (url)` with spaces to standard Markdown links `[text](url)`).
- **Text Styling Cleanups**: Fixed over-italicized bio rendering bugs to restore standard readable prose.
- **Aesthetic Tags**: Included helpful "Markdown Supported" badge icons above input fields.

### 3. Editor Rich Preview Fields
- Added clean **"Live Preview"** interactive tabs above Biography and Slide Notes rich text inputs in the profile editor.
- Permits real-time checking of format, structure, headers, lists, and links before database updates.

### 4. Selection & Copy/Paste Re-enabled
- Removed confusing `select-none` constraints from lists, grids, administrative panels, and profile fields.
- Full support restored for keyboard shortcuts (Cmd+A, Ctrl+C, Ctrl+V, mouse drag selections) to let users easily copy, paste, and edit facts, codes, and emails.

---

## 📦 Tech Stack & Structure

- **Frontend**: React 19, Tailwind CSS v4, Lucide Icons, React Markdown
- **Backend**: Node.js Express server running on Cloud Run
- **Database / Auth**: Google Firebase (Firestore and Auth SDKs)
