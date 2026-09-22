// speech to text svc: gemini, groq whisper, openai whisper
'use strict';

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { withPage }   = require('../utils/browser');

const OUT = path.resolve('outputs');

// ── MIME type helper ──────────────────────────────────────────────────────────

function getAudioMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.mp3':  'audio/mpeg',
    '.wav':  'audio/wav',
    '.ogg':  'audio/ogg',
    '.m4a':  'audio/mp4',
    '.aac':  'audio/aac',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm',
    '.mp4':  'video/mp4',
    '.mov':  'video/quicktime',
  };
  return map[ext] || 'audio/mpeg';
}

const LANG_MAP = {
  vi: 'Vietnamese (Tiếng Việt)',
  en: 'English',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  th: 'Thai',
  auto: 'auto-detect',
};

// ── Transcribe bằng Groq Whisper (Rất nhanh & Hoàn toàn miễn phí) ────────────

async function transcribeWithGroq(filePath, opts = {}) {
  const { language = 'vi', withTimestamps = false } = opts;
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY chưa được cấu hình trong .env');

  const fileBytes = fs.readFileSync(filePath);
  const fileSizeMB = fileBytes.length / (1024 * 1024);
  if (fileSizeMB > 25) {
    throw new Error(`File quá lớn (${fileSizeMB.toFixed(1)}MB). Giới hạn là 25MB.`);
  }

  const formData = new FormData();
  const blob = new Blob([fileBytes], { type: getAudioMime(filePath) });
  formData.append('file', blob, path.basename(filePath));
  formData.append('model', 'whisper-large-v3');
  if (language && language !== 'auto') {
    formData.append('language', language);
  }
  formData.append('response_format', withTimestamps ? 'verbose_json' : 'json');
  formData.append('temperature', '0');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Groq Whisper API lỗi (${response.status}): ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();

  if (withTimestamps && data.segments) {
    const textWithTimestamps = data.segments
      .map(seg => {
        const mm = Math.floor(seg.start / 60).toString().padStart(2, '0');
        const ss = Math.floor(seg.start % 60).toString().padStart(2, '0');
        return `[${mm}:${ss}] ${seg.text.trim()}`;
      })
      .join('\n');

    return {
      text: textWithTimestamps,
      plain: data.text,
      segments: data.segments,
      provider: 'Groq Whisper (Llama/Whisper-v3)',
      language: data.language || language,
      duration: data.duration,
    };
  }

  const text = data.text || '';
  return {
    text: text.trim(),
    plain: text.trim(),
    provider: 'Groq Whisper (Whisper-v3)',
    language: data.language || language,
    duration: data.duration || null,
  };
}

// ── Transcribe bằng Google Gemini ────────────────────────────────────────────

async function transcribeWithGemini(filePath, opts = {}) {
  const { language = 'vi', withTimestamps = false } = opts;
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GOOGLE_AI_API_KEY chưa được cấu hình trong .env');

  const audioBytes = fs.readFileSync(filePath);
  const fileSizeMB = audioBytes.length / (1024 * 1024);

  // Gemini inline_data: giới hạn ~20MB
  if (fileSizeMB > 20) {
    throw new Error(`File quá lớn (${fileSizeMB.toFixed(1)}MB). Gemini inline hỗ trợ tối đa 20MB.`);
  }

  const base64Audio = audioBytes.toString('base64');
  const mimeType    = getAudioMime(filePath);

  const timestampInstruction = withTimestamps
    ? 'Format output with timestamps every ~30 seconds: [MM:SS] transcribed text'
    : 'Return ONLY the transcribed text, no timestamps, no explanations.';

  const prompt = `Transcribe the audio content to text verbatim.
Language: ${LANG_MAP[language] || language}
${timestampInstruction}
If the audio is unclear or inaudible in parts, write [không rõ] for Vietnamese or [inaudible] for English.
Do NOT add any explanation, metadata, introduction, or commentary.`;

  const model = process.env.GEMINI_FLASH_MODEL || 'gemini-1.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Audio } },
            { text: prompt },
          ],
        }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini API lỗi (${response.status}): ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('Gemini không trả về kết quả. File có thể không có âm thanh hoặc không hợp lệ.');

  return { text: text.trim(), plain: text.trim(), provider: 'Google Gemini', language };
}

// ── Transcribe bằng OpenAI Whisper (Tùy chọn) ────────────────────────────────

async function transcribeWithWhisper(filePath, opts = {}) {
  const { language = 'vi', withTimestamps = false } = opts;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY chưa được cấu hình trong .env');

  let OpenAI;
  try {
    OpenAI = require('openai').OpenAI;
  } catch {
    throw new Error('Cần cài package: npm install openai');
  }

  const client = new OpenAI({ apiKey: key });
  const responseFormat = withTimestamps ? 'verbose_json' : 'text';

  const transcription = await client.audio.transcriptions.create({
    file:            fs.createReadStream(filePath),
    model:           'whisper-1',
    language:        language === 'auto' ? undefined : language,
    response_format: responseFormat,
    temperature:     0,
  });

  if (withTimestamps && typeof transcription === 'object' && transcription.segments) {
    const textWithTimestamps = transcription.segments
      .map(seg => {
        const mm = Math.floor(seg.start / 60).toString().padStart(2, '0');
        const ss = Math.floor(seg.start % 60).toString().padStart(2, '0');
        return `[${mm}:${ss}] ${seg.text.trim()}`;
      })
      .join('\n');

    return {
      text:     textWithTimestamps,
      plain:    transcription.text,
      segments: transcription.segments,
      provider: 'OpenAI Whisper',
      language: transcription.language || language,
      duration: transcription.duration,
    };
  }

  const text = typeof transcription === 'string' ? transcription : transcription.text;
  return { text: text.trim(), plain: text.trim(), provider: 'OpenAI Whisper', language };
}

// ── Smart router: tự chọn provider tối ưu ─────────────────────────────────────

async function transcribeAudio(filePath, opts = {}) {
  const { provider = 'auto' } = opts;

  const hasGroq    = !!process.env.GROQ_API_KEY;
  const hasGemini  = !!(process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY);
  const hasWhisper = !!process.env.OPENAI_API_KEY;

  if (provider === 'whisper' && hasWhisper) {
    return await transcribeWithWhisper(filePath, opts);
  }

  if (provider === 'gemini' && hasGemini) {
    return await transcribeWithGemini(filePath, opts);
  }

  if (provider === 'groq' && hasGroq) {
    return await transcribeWithGroq(filePath, opts);
  }

  // Chế độ 'auto': ưu tiên Groq Whisper (cực nhanh và chính xác) -> fallback Gemini -> fallback OpenAI Whisper
  if (hasGroq) {
    try {
      return await transcribeWithGroq(filePath, opts);
    } catch (err) {
      console.warn('[speech] Groq Whisper lỗi, fallback Gemini:', err.message);
      if (hasGemini) {
        return await transcribeWithGemini(filePath, opts);
      }
      throw err;
    }
  }

  if (hasGemini) {
    return await transcribeWithGemini(filePath, opts);
  }

  if (hasWhisper) {
    return await transcribeWithWhisper(filePath, opts);
  }

  throw new Error('Cần cấu hình GROQ_API_KEY, GOOGLE_AI_API_KEY hoặc OPENAI_API_KEY trong .env');
}

// ── Tạo file SRT từ text + segments ─────────────────────────────────────────

function toSRT(text, segments = null) {
  if (segments && segments.length) {
    return segments.map((seg, i) => {
      const fmt = (s) => {
        const h  = Math.floor(s / 3600).toString().padStart(2, '0');
        const m  = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
        const ss = Math.floor(s % 60).toString().padStart(2, '0');
        const ms = Math.round((s % 1) * 1000).toString().padStart(3, '0');
        return `${h}:${m}:${ss},${ms}`;
      };
      return `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text.trim()}\n`;
    }).join('\n');
  }

  // Ước tính timestamp từ số từ (150 words/min)
  const words = (text || '').split(/\s+/).filter(Boolean);
  const CHUNK = 12;
  const WPM   = 150;

  const chunks = [];
  for (let i = 0; i < words.length; i += CHUNK) {
    chunks.push(words.slice(i, i + CHUNK).join(' '));
  }

  return chunks.map((chunk, i) => {
    const startSec = (i * CHUNK / WPM) * 60;
    const endSec   = ((i + 1) * CHUNK / WPM) * 60;
    const fmt = (s) => {
      const m  = Math.floor(s / 60).toString().padStart(2, '0');
      const ss = Math.floor(s % 60).toString().padStart(2, '0');
      const ms = Math.round((s % 1) * 1000).toString().padStart(3, '0');
      return `00:${m}:${ss},${ms}`;
    };
    return `${i + 1}\n${fmt(startSec)} --> ${fmt(endSec)}\n${chunk}\n`;
  }).join('\n');
}

// xuat text sang pdf
async function exportAsPdf(text, opts = {}) {
  const { title = 'Bản Ghi Âm & Nhận Dạng Giọng Nói', language = 'vi' } = opts;

  return await withPage(async (page) => {
    const cleanText = (text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\[(\d+:\d+)\]/g, '<span style="color:#e11d48;font-weight:bold;">[$1]</span>');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.8; background: #fff; }
  h1 { color: #0f172a; font-size: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 8px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
  .content { font-size: 14px; white-space: pre-wrap; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
  .footer { margin-top: 30px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px; }
</style></head><body>
<h1>🎙️ ${title}</h1>
<div class="meta">
  Ngôn ngữ: ${LANG_MAP[language] || language} ·
  Tổng số từ: ${(text || '').split(/\s+/).filter(Boolean).length} ·
  Thời gian tạo: ${new Date().toLocaleString('vi-VN')}
</div>
<div class="content">${cleanText}</div>
<div class="footer">Tạo tự động bởi FileTools Pro Speech-to-Text Engine</div>
</body></html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    const outPath = path.join(OUT, `transcript_${uuidv4()}.pdf`);
    await page.pdf({
      path: outPath,
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });
    return outPath;
  });
}

module.exports = {
  transcribeAudio,
  toSRT,
  exportAsPdf,
  transcribeWithGroq,
  transcribeWithGemini,
  transcribeWithWhisper,
};
