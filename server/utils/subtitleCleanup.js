'use strict';

/**
 * subtitleCleanup.js — Bộ công cụ phân tích, chuẩn hóa và làm sạch phụ đề.
 * Tích hợp các thuật toán tối ưu từ mã nguồn mở WhisperSubTranslate:
 * 1. Lọc ảo giác (Hallucination) của Whisper khi gặp khoảng lặng dài.
 * 2. Lọc bỏ thẻ âm thanh SDH ([music], [applause], ♪♪) để tránh đọc lỗi khi lồng tiếng TTS.
 * 3. Chống đè mốc thời gian (Overlap fix) giữa các câu liên tiếp.
 * 4. Chuẩn hóa định dạng SRT / VTT và bóc tách cấu trúc cue.
 */

// Danh sách từ khóa SDH (Sound for Deaf and Hard of Hearing) phổ biến
const SDH_KEYWORDS = [
  'music', 'song', 'melody', 'theme', 'jingle',
  'applause', 'clapping', 'clap', 'cheering', 'cheer',
  'laughter', 'laugh', 'laughing', 'chuckles', 'giggling',
  'sobbing', 'sob', 'crying', 'cries', 'sigh', 'sighs',
  'groan', 'groans', 'grunt', 'gasp', 'gasps', 'scream',
  'screaming', 'screams', 'yell', 'shout', 'whisper',
  'humming', 'whistling', 'cough', 'coughing', 'sneeze',
  'knock', 'knocking', 'doorbell', 'ring', 'ringing',
  'phone', 'beep', 'beeps', 'buzzer', 'alarm', 'siren',
  'silence', 'inaudible', 'background noise', 'ambient sounds',
  'nhạc', 'tiếng nhạc', 'vỗ tay', 'tiếng vỗ tay', 'cười',
  'tiếng cười', 'khóc', 'thở dài', 'tiếng chuông', 'tiếng còi'
];

/**
 * Chuyển số giây (float) thành định dạng SRT HH:MM:SS,mmm
 */
function formatSrtTimestamp(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Chuyển chuỗi HH:MM:SS,mmm hoặc HH:MM:SS.mmm thành số giây
 */
function parseTimestamp(timestampStr) {
  if (!timestampStr) return 0;
  const normalized = timestampStr.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return m * 60 + s;
  }
  return parseFloat(normalized) || 0;
}

/**
 * Parse chuỗi văn bản .SRT thành mảng các cues
 * @param {string} srtText 
 * @returns {Array<{ id: number, start: number, end: number, startTime: string, endTime: string, text: string }>}
 */
function parseSrt(srtText) {
  if (!srtText || typeof srtText !== 'string') return [];
  const normalized = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/).filter(b => b.trim());

  const cues = [];
  let fallbackId = 1;

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIdx = 0;
    let id = fallbackId;

    if (/^\d+$/.test(lines[0])) {
      id = parseInt(lines[0], 10);
      timeLineIdx = 1;
    }

    const timeLine = lines[timeLineIdx];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);
    const text = lines.slice(timeLineIdx + 1).join('\n');

    if (text) {
      cues.push({
        id: cues.length + 1,
        originalId: id,
        start,
        end: end > start ? end : start + 1.5,
        startTime: formatSrtTimestamp(start),
        endTime: formatSrtTimestamp(end > start ? end : start + 1.5),
        text
      });
      fallbackId++;
    }
  }

  return cues;
}

/**
 * Xuất mảng cues thành chuỗi định dạng SRT chuẩn
 */
function stringifySrt(cues) {
  if (!Array.isArray(cues) || cues.length === 0) return '';
  return cues
    .map((cue, index) => {
      const startStr = cue.startTime || formatSrtTimestamp(cue.start);
      const endStr = cue.endTime || formatSrtTimestamp(cue.end);
      const cleanText = (cue.text || '').trim();
      return `${index + 1}\n${startStr} --> ${endStr}\n${cleanText}\n`;
    })
    .join('\n');
}

/**
 * Xuất mảng cues thành chuỗi định dạng VTT (Web Video Text Tracks)
 */
function stringifyVtt(cues) {
  if (!Array.isArray(cues) || cues.length === 0) return 'WEBVTT\n\n';
  const body = cues
    .map((cue, index) => {
      const startStr = (cue.startTime || formatSrtTimestamp(cue.start)).replace(',', '.');
      const endStr = (cue.endTime || formatSrtTimestamp(cue.end)).replace(',', '.');
      const cleanText = (cue.text || '').trim();
      return `${index + 1}\n${startStr} --> ${endStr}\n${cleanText}\n`;
    })
    .join('\n');
  return `WEBVTT\n\n${body}`;
}

/**
 * Lọc bỏ các thẻ chú thích âm thanh SDH (ví dụ: [music playing], (applause), ♪♪)
 */
function removeSdhTags(text) {
  if (!text) return '';
  let cleaned = text;

  // Lọc bỏ ký tự âm nhạc
  cleaned = cleaned.replace(/[♪♫♬♩]+/g, '').trim();

  // Lọc bỏ chú thích nằm trong ngoặc vuông [] hoặc tròn () nếu chứa từ khóa SDH
  cleaned = cleaned.replace(/[\[\(]([^\]\)]+)[\]\)]/g, (match, inner) => {
    const lower = inner.toLowerCase();
    const isSdh = SDH_KEYWORDS.some(kw => lower.includes(kw));
    return isSdh ? '' : match;
  });

  // Lọc bỏ các ký hiệu người nói của Whisper (>>, >>>)
  cleaned = cleaned.replace(/^>>+/, '').trim();

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Triệt tiêu ảo giác (Hallucination) lặp từ của Whisper khi im lặng
 * Thuật toán phát hiện các câu giống hệt nhau hoặc lặp mẫu liên tiếp
 */
function cleanWhisperHallucinations(cues) {
  if (!Array.isArray(cues) || cues.length <= 1) return cues;

  const result = [];
  let consecutiveDuplicates = 0;
  let lastText = '';

  for (const cue of cues) {
    const normalizedText = (cue.text || '')
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalizedText) continue;

    if (normalizedText === lastText) {
      consecutiveDuplicates++;
      // Nếu lặp lại quá 2 lần cùng một câu trong khoảng lặng thì bỏ qua các câu sau
      if (consecutiveDuplicates >= 2) {
        continue;
      }
    } else {
      consecutiveDuplicates = 0;
      lastText = normalizedText;
    }

    // Kiểm tra lặp từ nội bộ trong 1 câu (ví dụ: "thank you. thank you. thank you. thank you.")
    const words = normalizedText.split(' ');
    if (words.length >= 6) {
      const half = Math.floor(words.length / 2);
      const firstHalf = words.slice(0, half).join(' ');
      const secondHalf = words.slice(half, half * 2).join(' ');
      if (firstHalf === secondHalf && firstHalf.length > 8) {
        cue.text = cue.text.split(/[.,!?]/)[0] + '.';
      }
    }

    result.push({ ...cue });
  }

  // Đánh lại số thứ tự ID
  return result.map((c, i) => ({ ...c, id: i + 1 }));
}

/**
 * Tự động sửa lỗi chồng chéo mốc thời gian (Overlap fix)
 * Đảm bảo thời gian bắt đầu của câu sau không đè lên câu trước
 */
function fixTimestampOverlaps(cues, minGapSec = 0.05) {
  if (!Array.isArray(cues) || cues.length <= 1) return cues;

  const fixed = cues.map(c => ({ ...c }));

  for (let i = 0; i < fixed.length - 1; i++) {
    const current = fixed[i];
    const next = fixed[i + 1];

    if (current.end > next.start) {
      // Nếu câu trước lấn sang câu sau, co thời gian kết thúc của câu trước lại
      current.end = Math.max(current.start + 0.5, next.start - minGapSec);
      current.endTime = formatSrtTimestamp(current.end);
    }
  }

  return fixed;
}

/**
 * Toàn bộ quy trình dọn dẹp phụ đề tổng thể
 */
function cleanupSubtitles(cues, options = {}) {
  const {
    filterSdh = true,
    filterHallucinations = true,
    fixOverlaps = true
  } = options;

  let processed = cues.map(c => ({
    ...c,
    text: filterSdh ? removeSdhTags(c.text) : (c.text || '').trim()
  })).filter(c => c.text && c.text.trim().length > 0);

  if (filterHallucinations) {
    processed = cleanWhisperHallucinations(processed);
  }

  if (fixOverlaps) {
    processed = fixTimestampOverlaps(processed);
  }

  return processed.map((c, i) => ({
    ...c,
    id: i + 1,
    startTime: formatSrtTimestamp(c.start),
    endTime: formatSrtTimestamp(c.end)
  }));
}

module.exports = {
  formatSrtTimestamp,
  parseTimestamp,
  parseSrt,
  stringifySrt,
  stringifyVtt,
  removeSdhTags,
  cleanWhisperHallucinations,
  fixTimestampOverlaps,
  cleanupSubtitles,
  SDH_KEYWORDS
};
