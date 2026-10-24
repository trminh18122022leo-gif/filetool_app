import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles, Play, CheckCircle2, AlertCircle, Clock,
  FileText, ArrowRight, Upload, X, Download, ShieldCheck,
  RefreshCw, Layers, FileCode, ScanText, Image, RotateCw,
  FolderArchive, ChevronRight, Zap, StopCircle
} from 'lucide-react';
import { formatBytes } from '../utils/fileHelpers';
import MetaTags from '../components/seo/MetaTags';

const API = import.meta.env.VITE_API_URL || '';

export default function WorkflowStudioPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [templates, setTemplates]       = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeDag, setActiveDag]       = useState(null);
  const [inputFiles, setInputFiles]     = useState([]);
  const [quotaPreview, setQuotaPreview] = useState(null);
  const [validating, setValidating]     = useState(false);

  // Execution State
  const [runId, setRunId]               = useState(null);
  const [runStatus, setRunStatus]       = useState(null); // 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  const [nodeStates, setNodeStates]     = useState({});
  const [artifacts, setArtifacts]       = useState([]);
  const [runError, setRunError]         = useState(null);
  const [isExecuting, setIsExecuting]   = useState(false);

  const fileInputRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. Load Templates on mount
  useEffect(() => {
    fetch(`${API}/api/workflows/templates`, { headers: authHeader })
      .then(res => res.ok ? res.json() : {})
      .then(data => {
        if (data.templates && data.templates.length > 0) {
          setTemplates(data.templates);
          selectTemplate(data.templates[1] || data.templates[0]);
        }
      })
      .catch(err => console.error('Lỗi tải templates:', err));
  }, [token]);

  // 2. Select Template & Validate DAG
  const selectTemplate = async (tpl) => {
    setSelectedTemplate(tpl);
    setActiveDag(tpl.dag);
    setRunId(null);
    setRunStatus(null);
    setNodeStates({});
    setArtifacts([]);
    setRunError(null);

    // Validate DAG structure & compute estimated quota
    setValidating(true);
    try {
      const res = await fetch(`${API}/api/workflows/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ dag: tpl.dag }),
      });
      if (res.ok) {
        const val = await res.json();
        setQuotaPreview(val);
      }
    } catch (_) {}
    setValidating(false);
  };

  // 3. File Selection Handler
  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles) => {
    setInputFiles(prev => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, 50); // MAX_INPUT_FILES = 50
    });
  };

  const removeFile = (index) => {
    setInputFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 4. Execute Workflow Run
  const handleStartWorkflow = async () => {
    if (inputFiles.length === 0) {
      alert('Vui lòng chọn ít nhất một tệp tin đầu vào để thực thi quy trình');
      return;
    }

    setIsExecuting(true);
    setRunStatus('RUNNING');
    setRunError(null);
    setArtifacts([]);

    try {
      const formData = new FormData();
      formData.append('dag', JSON.stringify(activeDag));
      formData.append('title', selectedTemplate ? selectedTemplate.title : 'Quy trình tùy chỉnh');
      if (selectedTemplate?.templateId) {
        formData.append('templateId', selectedTemplate.templateId);
      }

      inputFiles.forEach(f => {
        formData.append('files', f);
      });

      // Generate client-side idempotency key for network resilience
      const idempotencyKey = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const res = await fetch(`${API}/api/workflows/run`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
          ...authHeader,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Khởi chạy quy trình thất bại');
      }

      const activeRunId = data.runId || (data.run && data.run.runId);
      setRunId(activeRunId);
      startPolling(activeRunId, data.sessionSecret);
    } catch (err) {
      setRunError(err.message);
      setRunStatus('FAILED');
      setIsExecuting(false);
    }
  };

  // 5. Polling for confirmed backend progress
  const startPolling = (currentRunId, sessionSecret) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const headers = { ...authHeader };
    if (sessionSecret) headers['x-session-secret'] = sessionSecret;

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/workflows/run/${currentRunId}`, { headers });
        if (!res.ok) return;

        const data = await res.json();
        const run = data.run;
        if (!run) return;

        setRunStatus(run.status);
        if (run.nodeStates) setNodeStates(run.nodeStates);

        if (run.status === 'COMPLETED') {
          clearInterval(pollIntervalRef.current);
          setIsExecuting(false);
          setArtifacts(run.artifacts || []);
        } else if (run.status === 'FAILED' || run.status === 'CANCELLED') {
          clearInterval(pollIntervalRef.current);
          setIsExecuting(false);
          setRunError(run.error || `Quy trình kết thúc với trạng thái ${run.status}`);
        }
      } catch (pollErr) {
        console.warn('Polling error:', pollErr);
      }
    }, 1500);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // 6. Cancel Execution
  const handleCancelRun = async () => {
    if (!runId) return;
    try {
      await fetch(`${API}/api/workflows/run/${runId}/cancel`, {
        method: 'POST',
        headers: authHeader,
      });
      setRunStatus('CANCELLED');
      setIsExecuting(false);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    } catch (err) {
      alert(`Lỗi khi hủy quy trình: ${err.message}`);
    }
  };

  const getOperatorIcon = (op) => {
    switch (op) {
      case 'input_source': return <Upload size={14} className="text-cyan-400" />;
      case 'merge':        return <Layers size={14} className="text-blue-400" />;
      case 'split':        return <FolderArchive size={14} className="text-indigo-400" />;
      case 'compress':     return <Zap size={14} className="text-amber-400" />;
      case 'ocr':          return <ScanText size={14} className="text-purple-400" />;
      case 'convert':      return <FileCode size={14} className="text-emerald-400" />;
      case 'watermark':    return <ShieldCheck size={14} className="text-pink-400" />;
      case 'rotate':       return <RotateCw size={14} className="text-teal-400" />;
      case 'export':       return <Download size={14} className="text-green-400" />;
      default:             return <FileText size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16">
      <MetaTags
        title="Workflow Studio — Tự Động Hóa Xử Lý File Đa Bước"
        description="Kết hợp đa công cụ xử lý file thành chuỗi tự động hóa an toàn theo đồ thị có hướng DAG: Nén, OCR, Che PII và xuất lưu trữ tự động."
        canonicalPath="/workflows"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'Workflow Studio', path: '/workflows' },
        ]}
      />
      {/* Top Header */}
      <div className="bg-gradient-to-r from-purple-950/40 via-blue-950/30 to-gray-900 border border-purple-800/30 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full">
              Orchestration Engine v1
            </span>
            <span className="text-xs text-gray-400 font-mono">Durable DAG Flow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Sparkles className="text-purple-400" size={26} /> Workflow Studio
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Kết hợp đa công cụ xử lý file thành chuỗi tự động hóa an toàn, không có mã script tùy tiện.
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-gray-700"
        >
          My Files →
        </button>
      </div>

      {/* Starter Templates Picker */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers size={16} className="text-cyan-400" /> Chọn Mẫu Quy Trình Có Sẵn
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {templates.map(tpl => {
            const isSelected = selectedTemplate?.templateId === tpl.templateId;
            return (
              <div
                key={tpl.templateId}
                onClick={() => selectTemplate(tpl)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-purple-950/30 border-purple-500/80 shadow-[0_0_20px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/50'
                    : 'bg-gray-900/60 border-gray-800 hover:border-gray-700 hover:bg-gray-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-bold text-white line-clamp-1">{tpl.title}</h3>
                  <span className="px-2 py-0.5 bg-purple-900/40 text-purple-300 rounded text-[10px] font-mono shrink-0">
                    {tpl.quotaCost || 1} Quota
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {tpl.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Pipeline Graph & DAG Nodes */}
      {activeDag && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Luồng Xử Lý (DAG Pipeline)</span>
                {validating && <RefreshCw size={12} className="animate-spin text-cyan-400" />}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Các bước thực thi tuần tự theo giải thuật Kahn. Định danh toán tử nằm trong Allowlist.
              </p>
            </div>

            {quotaPreview && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-400">Ước tính tiêu hao:</span>
                <span className="font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-800/60">
                  {quotaPreview.estimatedQuotaUnits} Hạn mức
                </span>
              </div>
            )}
          </div>

          {/* Node Flow Representation */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {activeDag.nodes.map((node, index) => {
              const state = nodeStates[node.id];
              let nodeBorderColor = 'border-gray-700';
              let nodeBgColor = 'bg-gray-950';

              if (state?.status === 'COMPLETED') {
                nodeBorderColor = 'border-emerald-500/60';
                nodeBgColor = 'bg-emerald-950/20';
              } else if (state?.status === 'RUNNING') {
                nodeBorderColor = 'border-cyan-400';
                nodeBgColor = 'bg-cyan-950/30 animate-pulse';
              } else if (state?.status === 'FAILED') {
                nodeBorderColor = 'border-red-500';
                nodeBgColor = 'bg-red-950/30';
              }

              return (
                <div key={node.id} className="flex items-center gap-2.5">
                  <div className={`p-3 rounded-xl border ${nodeBorderColor} ${nodeBgColor} transition-all min-w-[140px]`}>
                    <div className="flex items-center gap-2">
                      {getOperatorIcon(node.operator)}
                      <span className="text-xs font-bold text-white capitalize">{node.operator}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[130px]">
                      {node.label || node.id}
                    </p>
                    {state?.status && (
                      <span className={`inline-block mt-1 text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        state.status === 'COMPLETED' ? 'bg-emerald-900/60 text-emerald-300' :
                        state.status === 'RUNNING'   ? 'bg-cyan-900/60 text-cyan-300' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {state.status}
                      </span>
                    )}
                  </div>
                  {index < activeDag.nodes.length - 1 && (
                    <ChevronRight size={16} className="text-gray-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch Files Dropzone */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Upload size={14} className="text-cyan-400" /> Tệp Tin Đầu Vào (Batch Files)
        </h3>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-700 hover:border-cyan-500/60 rounded-2xl p-8 text-center cursor-pointer bg-gray-900/40 hover:bg-gray-900/70 transition-all space-y-2"
        >
          <Upload size={28} className="mx-auto text-gray-500" />
          <p className="text-xs font-medium text-white">Kéo thả hoặc click để chọn danh sách file</p>
          <p className="text-[11px] text-gray-400">Hỗ trợ PDF, Ảnh JPG/PNG, Văn bản TXT/DOCX (Tối đa 50 file)</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>

        {/* Selected Files List */}
        {inputFiles.length > 0 && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-gray-800">
              <span>Đã chọn {inputFiles.length} tệp</span>
              <button
                onClick={() => setInputFiles([])}
                className="text-red-400 hover:underline text-[11px]"
              >
                Xóa tất cả
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-gray-800/60">
              {inputFiles.map((file, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 max-w-[80%]">
                    <FileText size={14} className="text-cyan-400 shrink-0" />
                    <span className="text-gray-200 truncate">{file.name}</span>
                    <span className="text-gray-500 text-[11px]">({formatBytes(file.size)})</span>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action / Execution Area */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-900/80 border border-gray-800 p-5 rounded-2xl">
        <div className="text-xs text-gray-400">
          {runStatus === 'RUNNING' && (
            <span className="flex items-center gap-2 text-cyan-400 font-semibold animate-pulse">
              <RefreshCw size={14} className="animate-spin" /> Đang thực thi các toán tử trong Sandbox...
            </span>
          )}
          {runStatus === 'COMPLETED' && (
            <span className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 size={16} /> Toàn bộ các toán tử đã hoàn thành thành công!
            </span>
          )}
          {runStatus === 'FAILED' && (
            <span className="flex items-center gap-2 text-red-400 font-semibold">
              <AlertCircle size={16} /> Lỗi thực thi: {runError}
            </span>
          )}
          {runStatus === 'CANCELLED' && (
            <span className="text-amber-400 font-semibold">Quy trình đã được hủy an toàn và hoàn trả quota.</span>
          )}
          {!runStatus && (
            <span>Sẵn sàng khởi chạy quy trình tự động.</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isExecuting && (
            <button
              onClick={handleCancelRun}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-red-800/60"
            >
              <StopCircle size={14} /> Hủy Quy Trình
            </button>
          )}

          <button
            disabled={isExecuting || inputFiles.length === 0}
            onClick={handleStartWorkflow}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
          >
            <Play size={14} /> Khởi Chạy Quy Trình
          </button>
        </div>
      </div>

      {/* Result Artifacts Section */}
      {artifacts.length > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={18} /> Thành Phẩm Đã Được Đóng Gói Hoàn Hảo
            </h3>
            <span className="text-xs text-emerald-400 font-mono">
              Đã tự động lưu vào My Files
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {artifacts.map(art => (
              <div
                key={art.fileId}
                className="bg-gray-950 border border-gray-800 p-4 rounded-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="text-emerald-400 shrink-0" size={18} />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-white truncate">{art.fileName}</p>
                    <p className="text-[11px] text-gray-500">{formatBytes(art.fileSize)}</p>
                  </div>
                </div>

                <a
                  href={`${API}${art.downloadUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Download size={12} /> Tải về
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
