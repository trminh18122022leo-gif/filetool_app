import { useState, useRef } from 'react';
import { Cloud, RefreshCw, Check } from 'lucide-react';

/**
 * Animated Download Button — hiệu ứng mũi tên kéo xuống như tấm màn
 */
function CurtainDownloadBtn({ href, label = 'Download', fileName }) {
  const [state, setState] = useState('idle'); // idle | downloading | done
  const linkRef = useRef(null);

  const handleClick = (e) => {
    if (state === 'downloading') {
      e.preventDefault();
      return;
    }
    setState('downloading');
    // Sau 2.5s chuyển sang done, rồi reset
    setTimeout(() => {
      setState('done');
      setTimeout(() => setState('idle'), 2000);
    }, 2500);
  };

  return (
    <a
      ref={linkRef}
      href={href}
      download={fileName}
      onClick={handleClick}
      className="curtain-dl-btn group relative"
      data-state={state}
    >
      {/* Background layers */}
      <div className="curtain-dl-bg" />
      <div className="curtain-dl-curtain" />

      {/* Arrow icon */}
      <div className="curtain-dl-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      </div>

      {/* Text */}
      <span className="curtain-dl-text">
        {state === 'done' ? (
          <span className="flex items-center gap-1.5">
            <Check size={15} /> Hoàn tất
          </span>
        ) : state === 'downloading' ? 'Đang tải...' : label}
      </span>

      {/* Right arrow */}
      <div className="curtain-dl-arrow-right">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      </div>

      {/* Inline styles via CSS-in-JS for the animation */}
      <style>{`
        .curtain-dl-btn {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 14px 24px;
          border-radius: 16px;
          font-weight: 700;
          font-size: 14px;
          color: white;
          overflow: hidden;
          cursor: pointer;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.3s;
          min-height: 52px;
        }

        .curtain-dl-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 30px rgba(59, 130, 246, 0.4);
        }

        .curtain-dl-btn:active {
          transform: translateY(0);
        }

        /* Background gradient */
        .curtain-dl-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%);
          border-radius: inherit;
          z-index: 0;
        }

        /* Curtain overlay — mũi tên kéo xuống */
        .curtain-dl-curtain {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.05) 100%);
          z-index: 1;
          transform: translateY(-100%);
          transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
          border-radius: inherit;
        }

        .curtain-dl-btn[data-state="downloading"] .curtain-dl-curtain {
          transform: translateY(0%);
          animation: curtainSlide 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes curtainSlide {
          0%   { transform: translateY(-100%); }
          30%  { transform: translateY(0%); }
          70%  { transform: translateY(0%); }
          100% { transform: translateY(100%); }
        }

        /* Arrow icon (left side) */
        .curtain-dl-arrow {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          transition: transform 0.3s ease;
        }

        .curtain-dl-btn[data-state="downloading"] .curtain-dl-arrow {
          animation: arrowBounce 0.8s ease infinite;
        }

        .curtain-dl-btn[data-state="done"] .curtain-dl-arrow {
          transform: translateY(2px);
          opacity: 0.8;
        }

        @keyframes arrowBounce {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(5px); }
        }

        /* Arrow right */
        .curtain-dl-arrow-right {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          opacity: 0.7;
          transition: transform 0.3s, opacity 0.3s;
        }

        .curtain-dl-btn:hover .curtain-dl-arrow-right {
          opacity: 1;
          transform: translateY(3px);
        }

        .curtain-dl-btn[data-state="downloading"] .curtain-dl-arrow-right {
          animation: arrowBounce 0.8s ease 0.2s infinite;
        }

        /* Text */
        .curtain-dl-text {
          position: relative;
          z-index: 2;
          flex: 1;
          text-align: center;
          letter-spacing: 0.02em;
        }

        /* Done state — green overlay */
        .curtain-dl-btn[data-state="done"] .curtain-dl-bg {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transition: background 0.5s;
        }
      `}</style>
    </a>
  );
}

export default function ResultDownload({
  result,
  onReset,
  label = 'Download',
}) {
  if (!result) return null;

  const isBatch = Array.isArray(result.files);

  const getDownloadHref = (file) => {
    if (result.downloadUrl) return result.downloadUrl;
    return `/api/download/${encodeURIComponent(file)}`;
  };

  return (
    <div className="bg-gray-900/80 border border-gray-700/60 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check size={16} className="text-green-400" />
          </div>
          <h3 className="font-semibold text-white text-sm">Xử lý hoàn tất!</h3>
        </div>
        {result.cloud && (
          <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-full">
            <Cloud size={11} /> Đã lưu vào Cloud
          </span>
        )}
      </div>

      {isBatch ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Đã tạo {result.files.length} file:</p>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {result.files.map((f, i) => (
              <CurtainDownloadBtn
                key={i}
                href={getDownloadHref(f)}
                label={`Download · ${f}`}
                fileName={f}
              />
            ))}
          </div>
        </div>
      ) : (
        <CurtainDownloadBtn
          href={getDownloadHref(result.file)}
          label={label}
          fileName={result.file}
        />
      )}

      {onReset && (
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-xl text-xs font-medium transition-colors border border-gray-700/50"
        >
          <RefreshCw size={13} />
          Xử lý file khác
        </button>
      )}
    </div>
  );
}
