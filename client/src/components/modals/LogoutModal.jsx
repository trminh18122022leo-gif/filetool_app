import { useState } from 'react';
import { JellyBlobMascot, BlobSpeech } from 'feral-blob';
import 'feral-blob/blob.css';
import { X } from 'lucide-react';

const PALETTES = [
  {
    id: 'purple',
    name: 'Tím',
    dot: '#c084fc',
    style: {},
  },
  {
    id: 'mint',
    name: 'Bạc hà',
    dot: '#6ee7b7',
    style: {
      '--jelly-body-top': '#a7f3d0',
      '--jelly-body-mid': '#34d399',
      '--jelly-body-deep': '#059669',
      '--jelly-body-rim': '#6ee7b7',
      '--jelly-outline': '#047857',
      '--jelly-outline-light': '#34d399',
      '--jelly-arm-light': '#a7f3d0',
      '--jelly-arm-mid': '#34d399',
      '--jelly-arm-deep': '#059669',
      '--jelly-belly-glow': '#bbf7d0',
      '--jelly-eye-sparkle': '#6ee7b7',
    },
  },
  {
    id: 'coral',
    name: 'San hô',
    dot: '#fda4af',
    style: {
      '--jelly-body-top': '#fecdd3',
      '--jelly-body-mid': '#fb7185',
      '--jelly-body-deep': '#e11d48',
      '--jelly-body-rim': '#fda4af',
      '--jelly-outline': '#be123c',
      '--jelly-outline-light': '#fb7185',
      '--jelly-arm-light': '#fecdd3',
      '--jelly-arm-mid': '#fb7185',
      '--jelly-arm-deep': '#e11d48',
      '--jelly-belly-glow': '#fecdd3',
      '--jelly-eye-sparkle': '#fda4af',
    },
  },
  {
    id: 'gold',
    name: 'Vàng mật',
    dot: '#fcd34d',
    style: {
      '--jelly-body-top': '#fde68a',
      '--jelly-body-mid': '#fbbf24',
      '--jelly-body-deep': '#d97706',
      '--jelly-body-rim': '#fcd34d',
      '--jelly-outline': '#b45309',
      '--jelly-outline-light': '#fbbf24',
      '--jelly-arm-light': '#fde68a',
      '--jelly-arm-mid': '#fbbf24',
      '--jelly-arm-deep': '#d97706',
      '--jelly-belly-glow': '#fef08a',
      '--jelly-eye-sparkle': '#fcd34d',
    },
  },
];

export default function LogoutModal({ isOpen, onClose, onConfirm }) {
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [mood, setMood] = useState('sad');
  const [speechText, setSpeechText] = useState('Going somewhere?');

  if (!isOpen) return null;

  const currentPalette = PALETTES[paletteIndex];

  const handlePoke = () => {
    const moods = ['shy', 'wave', 'sad', 'hmm'];
    const nextMood = moods[Math.floor(Math.random() * moods.length)];
    setMood(nextMood);
    if (nextMood === 'wave') setSpeechText('Hẹn gặp lại bạn sớm nhé!');
    else if (nextMood === 'shy') setSpeechText('Đừng đi mà...');
    else if (nextMood === 'hmm') setSpeechText('Bạn có chắc không?');
    else setSpeechText('Going somewhere?');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      {/* Container wrapper matching Image 3 */}
      <div className="flex flex-col items-center max-w-sm w-full">
        {/* Color Palette Switcher on top */}
        <div className="flex items-center gap-3 mb-4 p-1.5 rounded-full bg-black/10 dark:bg-black/40 border border-black/10 dark:border-white/10 backdrop-blur-md">
          {PALETTES.map((pal, idx) => (
            <button
              key={pal.id}
              onClick={() => setPaletteIndex(idx)}
              className={`w-6 h-6 rounded-full transition-all duration-200 cursor-pointer ${
                paletteIndex === idx
                  ? 'ring-2 ring-amber-500 dark:ring-white scale-110 shadow-lg'
                  : 'opacity-70 hover:opacity-100 hover:scale-105'
              }`}
              style={{ backgroundColor: pal.dot }}
              title={`Màu ${pal.name}`}
              aria-label={`Chọn màu ${pal.name}`}
            />
          ))}
        </div>

        {/* Modal Card */}
        <div
          style={currentPalette.style}
          className="relative w-full bg-white dark:bg-[#121319] border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center overflow-hidden transition-colors duration-300"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/15 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>

          {/* Speech Bubble */}
          <div className="mb-2 transition-all duration-300">
            <div className="relative inline-block px-4 py-2 rounded-2xl bg-gray-100 dark:bg-[#20212a] border border-black/10 dark:border-white/10 text-gray-800 dark:text-white font-medium text-sm shadow-md after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-gray-100 dark:after:border-t-[#20212a]">
              {speechText}
            </div>
          </div>

          {/* Feral Blob Mascot */}
          <div
            className="w-36 h-36 my-2 cursor-pointer flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            onClick={handlePoke}
            title="Chạm vào tôi!"
          >
            <JellyBlobMascot
              mood={mood}
              onPoke={handlePoke}
              eyeStyle="v1"
              className="w-full h-full"
            />
          </div>

          {/* Content */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1 mb-1">
            Đăng Xuất?
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xs mb-6 leading-relaxed">
            Bạn sẽ cần đăng nhập lại để tiếp tục truy cập các tệp tin và công cụ nâng cao.
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 text-sm font-semibold transition-all cursor-pointer active:scale-95"
            >
              Hủy
            </button>
            <button
              onClick={onConfirm}
              className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(220,38,38,0.25)] cursor-pointer active:scale-95"
            >
              Đăng Xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
