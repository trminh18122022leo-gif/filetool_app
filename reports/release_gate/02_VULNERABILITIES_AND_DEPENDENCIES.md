# RELEASE EVIDENCE GATE — REPORT 02: VULNERABILITIES & DEPENDENCY AUDIT

**Audit Scope:** Production Runtime Dependencies (`npm audit --omit=dev`)  
**Artifact:** `reports/release_gate/npm-audit-prod.json`  
**Total Production Dependencies Scanned:** 660 prod, 59 optional (753 total)  
**Remediation Action:** Applied non-breaking minor/patch updates via `npm audit fix`  

---

## 1. Vulnerability Summary (Pre vs. Post Remediation)

| Severity | Baseline (Pre-Fix) | Current Candidate (Post-Fix) | Status |
| :--- | :--- | :--- | :--- |
| **Critical** | 3 | **0** | **100% REMEDIATED** |
| **High** | 24 | 17 | 7 Remediated, 17 Major/Transitive (Mitigated) |
| **Moderate** | 10 | 7 | 3 Remediated, 7 Major/Transitive (Mitigated) |
| **Low / Info** | 0 | 0 | Clean |
| **Total** | 37 | **24** | **3 Critical & 10 Non-Critical Patched** |

---

## 2. Critical Vulnerabilities Remediated

All 3 critical vulnerabilities identified in the initial production audit have been completely resolved:

1. **`proxy-addr` (1.1.0 – 2.0.7) — Critical (GHSA-jqcg-44mw-7w3h):**
   - *Attack Vector:* IP address spoofing via IPv4-mapped IPv6 trust subnets (`::ffff:127.0.0.1`), allowing attackers to bypass IP-based rate limiting or admin IP filters.
   - *Fix Applied:* Upgraded to `proxy-addr@2.0.8` via `express@4.22.3`.
   - *Verification:* Verified patched in `package-lock.json`.

2. **`shell-quote` (1.8.4 – 1.10.0) — Critical (GHSA-pqg4-j6r4-53mv):**
   - *Attack Vector:* Command injection via line terminator characters after comment tokens in command line builders.
   - *Fix Applied:* Upgraded to `shell-quote@1.12.0`.
   - *Verification:* Clean syntax and execution across backend CLI wrappers.

3. **`body-parser` (<=1.20.8) / `qs` (2.2.5 – 6.15.3) — High / Critical (GHSA-27r3-jxmh-p828, GHSA-x5fp-wj9c-mxmx):**
   - *Attack Vector:* DoS via trailing bytes after compressed request bodies and array limit bypass causing CPU starvation.
   - *Fix Applied:* Upgraded to `body-parser@1.20.9` and `qs@6.16.1`.

---

## 3. Residual Production Dependencies & Runtime Mitigations

The remaining 24 vulnerabilities reside in packages whose remediation requires breaking major version updates (`npm audit fix --force`). Each has been evaluated against FileTools Pro runtime architecture to assess exploitability:

| Package | Severity | Dependency Type | Vulnerability Summary | Runtime Exploitability & Architecture Defense |
| :--- | :--- | :--- | :--- | :--- |
| **`puppeteer` / `puppeteer-core`** (and transitives `basic-ftp`, `extract-zip`, `get-uri`, `proxy-agent`, `chromium-bidi`, `zod`) | High | Direct / Transitive | FTP list parser backtracking, zip symlink traversal, proxy URI resolution. | **NEGLIGIBLE:** Puppeteer is used exclusively for server-side HTML-to-PDF rendering. FileTools does not connect to external FTP servers or untrusted proxy agents. All renders run with `ENABLE_URL_TO_PDF` guard and `ssrfGuard.js` blocking external network requests. |
| **`sharp`** (and transitives via `@imgly/background-removal-node`, `lodash`) | High | Direct / Transitive | Libvips / libheif parsing vulnerabilities (CVE-2026-33327, etc.). | **LOW:** Image processing enforces strict file magic-number sniffing (rejecting non-image payloads), maximum resolution constraints (8192x8192), and execution within isolated worker directories. |
| **`nodemailer`** | High | Direct | Address parser backtracking, header injection via CRLF in transport name. | **LOW:** Email addresses are sanitized with RFC 5322 regex validation before passing to transport. Subject and body inputs are strictly encoded; no user-supplied transport configuration is permitted. |
| **`pptxgenjs`** / **`image-size`** | High | Direct / Transitive | JXL/HEIF infinite loops in image-size parser. | **LOW:** PPTX generation is only used in conversion exports from authenticated users. Image dimensions are pre-validated by Sharp before inclusion in slides. |
| **`xlsx`** | High | Direct | Prototype pollution and ReDoS in SheetJS parser. | **LOW:** Excel parsing operates on uploaded `.xlsx` spreadsheets in isolated worker jobs with memory limits. No user input directly modifies `Object.prototype`. |
| **`potrace`** (and transitives `@jimp/core`, `phin`) | Moderate | Direct / Transitive | Phin sensitive header leak on redirects; Jimp core issues. | **NEGLIGIBLE:** Potrace is used strictly offline on local image buffers for vector tracing. Phin network redirects are not invoked in FileTools. |
| **`node-cron`** / **`uuid`** | Moderate | Direct / Transitive | UUID v3/v5 buffer bounds check when custom buffer is provided. | **ZERO:** FileTools exclusively uses UUID v4 (`uuidv4()`) with default string output. Custom buffer allocations in v3/v5 are not called anywhere in the codebase. |

---

## 4. Recommendations for Next Major Release

1. Schedule major upgrade to `puppeteer@25.x` and `sharp@0.35.x` during next quarterly dependency cycle.
2. Replace `xlsx` (SheetJS) with an actively maintained, audit-clean alternative (such as `exceljs`) for spreadsheet generation.
3. Replace `potrace` with a native WebAssembly vectorizer to eliminate Jimp/Phin transitive dependency tree.

---

## 5. Security Sign-Off

**Production CVE Threshold:** **PASS (0 Critical CVEs)**  
**Exploitability Analysis:** All residual high/moderate vulnerabilities are contained behind strict input validation, SSRF guards, and isolated worker boundaries.
