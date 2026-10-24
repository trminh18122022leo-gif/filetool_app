# RELEASE EVIDENCE GATE — REPORT 07: WINDOWS PACKAGING & STORE EVIDENCE

**Audit Phase:** Antigravity Release Evidence Gate  
**Target:** Windows 10/11 Candidate (PWA / MSIX & Electron Preservation)  
**Test Suite:** `tests/releases/windows-release.test.js` (8 tests, 100% PASS, 6.58ms)  
**Packaging Status:** **CANDIDATE MANIFEST READY / MSIX BUILD BLOCKED ON PARTNER CENTER ID**  

---

## 1. Web App Manifest Windows Store Compliance

Verified in `client/public/manifest.webmanifest`:

```
✔ verifies critical identity and display properties for Windows MSIX (0.77ms)
✔ verifies icons include 192px, 512px and maskable formats (0.25ms)
✔ verifies native OS file handlers are defined for PDF, Word and Images (0.19ms)
✔ verifies Windows shortcuts / Jump List items are configured (0.13ms)
```

### 1.1 Manifest Identity & Display Properties
- **Name:** `FileTools Pro — Bộ công cụ xử lý file đa năng`
- **Short Name:** `FileTools Pro`
- **Display Mode:** `standalone`
- **Start URL:** `/?source=pwa`
- **Background Color:** `#0f172a`
- **Theme Color:** `#2563eb`

### 1.2 OS Integration (File Handlers & Jump Lists)
- **Windows File Associations:**
  - `application/pdf` (`.pdf`)
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`)
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`.xlsx`)
  - `image/png` (`.png`), `image/jpeg` (`.jpg`, `.jpeg`)
- **Windows Jump Lists (Taskbar Context Menu):**
  - "Gộp PDF" (`/pdf/merge`)
  - "Nén PDF" (`/pdf/compress`)
  - "OCR Nhận diện chữ" (`/pdf/ocr`)
  - "Workflow Studio" (`/workflows`)

---

## 2. Electron Configuration Preservation

Verified in `client/electron/main.js`:
- `singleInstanceLock` remains enforced, ensuring secondary window launches focus the existing instance.
- Deep-link protocol handlers (`filetools://`) and file drop event handlers are preserved in the codebase for native desktop packaging if full offline native packaging is requested.

---

## 3. Microsoft Store Certification & Packaging Blocker

### 3.1 Why Local MSIX Generation is BLOCKED
Generating a production-ready `.msix` package compliant with the Microsoft Store requires **Package Identity attributes**:
1. `Identity Name` (e.g., `45618YourName.FileToolsPro`)
2. `Publisher` (e.g., `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`)
3. `PublisherDisplayName` (e.g., `FileTools Software LLC`)

These values are generated uniquely by the **Microsoft Partner Center** when an application is registered under a verified developer account. Because AI agents do not possess developer account credentials or signing certificates, fabricating a pseudo-identity or self-signed certificate would result in an invalid package rejected by the Microsoft Store certification pipeline.

### 3.2 Reproducible PWABuilder Packaging Commands

Once the production owner registers the application in Microsoft Partner Center:

```bash
# 1. Install PWABuilder CLI globally
npm install -g @pwabuilder/cli

# 2. Package the PWA into an MSIX bundle
pwabuilder package https://filetool-app.vercel.app/manifest.webmanifest \
  --output ./dist-windows \
  --platform windows \
  --package-id "<OWNER_PARTNER_CENTER_PACKAGE_NAME>" \
  --publisher-id "<OWNER_PARTNER_CENTER_PUBLISHER_CN>" \
  --publisher-display-name "FileTools Pro" \
  --version "1.0.0.0"

# 3. Verify the generated .msix package
pwabuilder validate ./dist-windows/filetools-pro.msix
```

---

## 4. Store Listing Copy & System Requirements

- **Supported Architectures:** x64, ARM64 (Windows 10 version 19041.0 or higher / Windows 11).
- **Search Tags Defined:** `pdf`, `compress`, `ocr`, `convert`, `office`, `redact`, `workflow`.
- **Support & Privacy URLs:**
  - Support: `https://filetool-app.vercel.app/guides`
  - Privacy Policy: `https://filetool-app.vercel.app/privacy`

---

## 5. Windows Release Gate Verdict

**Manifest & Invariants:** **PASS (100% compliant)**  
**MSIX Packaging:** **BLOCKED (Requires Microsoft Partner Center credentials from production owner)**
