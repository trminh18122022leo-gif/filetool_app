import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Folder, Key, CreditCard, Download, Trash2,
  Plus, Copy, Check, Sparkles, HardDrive, Zap, Home,
  Search, RefreshCw, FileText, FileImage, FileArchive,
  FileCode, ShieldCheck, Undo2, Edit3, ArrowUpDown, Tag
} from 'lucide-react';
import { formatBytes } from '../utils/fileHelpers';
import MetaTags from '../components/seo/MetaTags';

const API = import.meta.env.VITE_API_URL || '';

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('files');

  // Files & Filter State
  const [files, setFiles]                 = useState([]);
  const [pagination, setPagination]       = useState({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });
  const [currentFolder, setCurrentFolder] = useState('all');
  const [searchQuery, setSearchQuery]     = useState('');
  const [sortBy, setSortBy]               = useState('newest');
  const [isTrash, setIsTrash]             = useState(false);
  const [availableFolders, setAvailableFolders] = useState(['Workflows', 'Documents', 'Archive']);

  // API Keys & Usage State
  const [apiKeys, setApiKeys]     = useState([]);
  const [usage, setUsage]         = useState(null);
  const [loading, setLoading]     = useState(true);

  // Rename Modal State
  const [renamingFile, setRenamingFile] = useState(null);
  const [newFileName, setNewFileName]   = useState('');

  // API Key Create State
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey]   = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  const loadFiles = useCallback(async (page = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        sort: sortBy,
        isTrash: isTrash ? 'true' : 'false',
      });
      if (currentFolder !== 'all' && !isTrash) {
        params.append('folder', currentFolder);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(`${API}/api/storage/files?${params.toString()}`, {
        headers: authHeader,
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Lỗi nạp danh sách tệp:', err);
    } finally {
      setLoading(false);
    }
  }, [token, currentFolder, searchQuery, sortBy, isTrash]);

  const loadKeysAndUsage = async () => {
    if (!token) return;
    try {
      const [keysRes, usageRes, foldersRes] = await Promise.all([
        fetch(`${API}/api/apikey`, { headers: authHeader }).then(r => r.ok ? r.json() : {}),
        fetch(`${API}/api/user/usage`, { headers: authHeader }).then(r => r.ok ? r.json() : {}),
        fetch(`${API}/api/storage/folders`, { headers: authHeader }).then(r => r.ok ? r.json() : {}),
      ]);
      if (keysRes.keys) setApiKeys(keysRes.keys);
      if (usageRes) setUsage(usageRes);
      if (foldersRes.folders && foldersRes.folders.length > 0) {
        setAvailableFolders(Array.from(new Set(['Workflows', 'Documents', 'Archive', ...foldersRes.folders])));
      }
    } catch (err) {
      console.error('Lỗi nạp dữ liệu tài khoản:', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadFiles(1);
      loadKeysAndUsage();
    }
  }, [token, loadFiles]);

  const handleDownloadFile = async (fileId) => {
    try {
      const res = await fetch(`${API}/api/storage/files/${fileId}/download`, { headers: authHeader });
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        alert(data.error || 'Không thể tạo liên kết tải an toàn');
      }
    } catch (err) {
      alert(`Lỗi tải file: ${err.message}`);
    }
  };

  const handleSoftDelete = async (fileId) => {
    if (!confirm('Chuyển file này vào Thùng rác? Bạn có thể khôi phục lại sau.')) return;
    try {
      const res = await fetch(`${API}/api/storage/files/${fileId}/trash`, {
        method: 'POST',
        headers: authHeader,
      });
      if (res.ok) {
        loadFiles(pagination.page);
      }
    } catch (err) {
      alert(`Lỗi chuyển thùng rác: ${err.message}`);
    }
  };

  const handleRestore = async (fileId) => {
    try {
      const res = await fetch(`${API}/api/storage/files/${fileId}/restore`, {
        method: 'POST',
        headers: authHeader,
      });
      if (res.ok) {
        loadFiles(pagination.page);
      }
    } catch (err) {
      alert(`Lỗi khôi phục: ${err.message}`);
    }
  };

  const handleHardDelete = async (fileId) => {
    if (!confirm('CẢNH BÁO: File sẽ bị xóa vĩnh viễn khỏi Cloudflare R2 và không thể khôi phục. Tiếp tục?')) return;
    try {
      const res = await fetch(`${API}/api/storage/files/${fileId}/cloud`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (res.ok) {
        loadFiles(pagination.page);
      }
    } catch (err) {
      alert(`Lỗi xóa vĩnh viễn: ${err.message}`);
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renamingFile || !newFileName.trim()) return;
    try {
      const res = await fetch(`${API}/api/storage/files/${renamingFile.fileId || renamingFile._id}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ newName: newFileName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi đổi tên file');
      setRenamingFile(null);
      loadFiles(pagination.page);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateKey = async () => {
    try {
      const res = await fetch(`${API}/api/apikey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ name: newKeyName || 'API Key' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCreatedKey(data.apiKey);
      setNewKeyName('');
      loadKeysAndUsage();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!confirm('Bạn có chắc muốn vô hiệu hóa API key này?')) return;
    try {
      await fetch(`${API}/api/apikey/${id}`, { method: 'DELETE', headers: authHeader });
      loadKeysAndUsage();
    } catch (err) {
      alert(err.message);
    }
  };

  const getFileIcon = (mimeType, name = '') => {
    if (mimeType?.includes('pdf') || name.endsWith('.pdf')) {
      return <FileText className="text-red-400 shrink-0" size={18} />;
    }
    if (mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name)) {
      return <FileImage className="text-blue-400 shrink-0" size={18} />;
    }
    if (mimeType?.includes('zip') || mimeType?.includes('tar') || /\.(zip|rar|7z|tar|gz)$/i.test(name)) {
      return <FileArchive className="text-amber-400 shrink-0" size={18} />;
    }
    if (/\.(js|jsx|ts|tsx|json|html|css|py|md)$/i.test(name)) {
      return <FileCode className="text-emerald-400 shrink-0" size={18} />;
    }
    return <FileText className="text-gray-400 shrink-0" size={18} />;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <MetaTags
        title="Không Gian Tệp Cá Nhân & Quản Trị Job"
        description="Quản lý tệp cá nhân, lịch sử công việc và cấu hình khóa API an toàn."
        noIndex={true}
      />
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-gray-900 border border-blue-800/40 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <span>Không Gian Tệp Cá Nhân</span>
            <span className="px-2.5 py-0.5 text-xs uppercase tracking-wider font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
              {user?.plan || 'Free'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Quản lý tệp đa thư mục, lịch sử quy trình Workflow Studio và khóa API an toàn.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/workflows')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            <Sparkles size={14} /> Workflow Studio
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-gray-700"
          >
            <Home size={14} /> Trang chủ
          </button>
        </div>
      </div>

      {/* Privacy Assurance Guarantee */}
      <div className="bg-slate-900/80 border border-cyan-500/20 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm">
        <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl shrink-0 mt-0.5">
          <ShieldCheck size={20} />
        </div>
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-cyan-300 font-semibold">Quyền Riêng Tư & Lưu Trữ Độc Quyền (Zero Public Access):</strong> Mọi tài liệu của bạn được cô lập theo định danh tài khoản, lưu trữ tại Cloudflare R2 với liên kết có chữ ký số (Signed URL) hết hạn tự động. Hệ thống không cho phép duyệt công khai và loại trừ nguy cơ rò rỉ chéo tenant.
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-950/80 text-blue-400 rounded-xl">
            <Zap size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400">Lượt xử lý hôm nay</p>
            <h3 className="text-xl font-bold text-white mt-0.5">
              {usage?.dailyUsage?.count || 0} <span className="text-xs font-normal text-gray-500">tác vụ</span>
            </h3>
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-950/80 text-indigo-400 rounded-xl">
            <HardDrive size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400">Dung lượng Cloud R2</p>
            <h3 className="text-xl font-bold text-white mt-0.5">
              {formatBytes(user?.cloudStorageUsed || 0)}
            </h3>
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-purple-950/80 text-purple-400 rounded-xl">
            <Key size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400">API Keys hoạt động</p>
            <h3 className="text-xl font-bold text-white mt-0.5">
              {apiKeys.filter(k => k.status === 'active').length}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => { setActiveTab('files'); setIsTrash(false); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'files' && !isTrash
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-900'
          }`}
        >
          <Folder size={14} /> My Files ({pagination.totalCount || files.length})
        </button>

        <button
          onClick={() => { setActiveTab('files'); setIsTrash(true); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'files' && isTrash
              ? 'bg-amber-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-900'
          }`}
        >
          <Trash2 size={14} /> Thùng rác
        </button>

        <button
          onClick={() => setActiveTab('keys')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'keys'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-900'
          }`}
        >
          <Key size={14} /> Quản lý API Key ({apiKeys.length})
        </button>
      </div>

      {/* Files Workspace Area */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Sub-Folders Toolbar (when not in Trash) */}
          {!isTrash && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setCurrentFolder('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  currentFolder === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'
                }`}
              >
                Tất cả thư mục
              </button>
              {availableFolders.map(folder => (
                <button
                  key={folder}
                  onClick={() => setCurrentFolder(folder)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    currentFolder === folder
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-gray-900 text-gray-400 hover:text-gray-200 border border-gray-800'
                  }`}
                >
                  <Folder size={12} /> {folder}
                </button>
              ))}
            </div>
          )}

          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-900/50 p-3 rounded-2xl border border-gray-800">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-950 border border-gray-800 rounded-xl px-3 py-1.5">
                <ArrowUpDown size={12} />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent text-gray-300 focus:outline-none cursor-pointer"
                >
                  <option value="newest" className="bg-gray-900">Mới nhất</option>
                  <option value="oldest" className="bg-gray-900">Cũ nhất</option>
                  <option value="name_asc" className="bg-gray-900">Tên (A-Z)</option>
                  <option value="size_desc" className="bg-gray-900">Dung lượng lớn</option>
                </select>
              </div>

              <button
                onClick={() => loadFiles(pagination.page)}
                className="p-2 bg-gray-950 hover:bg-gray-800 text-gray-300 rounded-xl border border-gray-800 transition-colors"
                title="Làm mới"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Files Table / List */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="h-12 bg-gray-850/60 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : files.length === 0 ? (
              <div className="p-14 text-center text-gray-500 space-y-3">
                <Folder size={36} className="mx-auto text-gray-600 stroke-[1.5]" />
                <p className="text-sm font-medium text-gray-300">
                  {isTrash ? 'Thùng rác trống.' : 'Chưa có file nào trong không gian này.'}
                </p>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  {isTrash
                    ? 'Các file bị xóa tạm sẽ lưu tại đây và có thể khôi phục bất cứ lúc nào.'
                    : 'Các file xử lý từ Workflow Studio hoặc công cụ PDF sẽ tự động xuất hiện tại đây.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-950 text-gray-400 border-b border-gray-800">
                    <tr>
                      <th className="p-4 font-semibold">Tên tệp</th>
                      <th className="p-4 font-semibold">Thư mục</th>
                      <th className="p-4 font-semibold">Dung lượng</th>
                      <th className="p-4 font-semibold">Thời gian</th>
                      <th className="p-4 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {files.map(f => {
                      const id = f.fileId || f._id;
                      return (
                        <tr key={id} className="hover:bg-gray-850/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2.5 max-w-[280px] sm:max-w-md">
                              {getFileIcon(f.mimeType, f.originalName)}
                              <span className="font-medium text-white truncate" title={f.originalName}>
                                {f.originalName}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-md text-[11px] font-mono">
                              {f.folder || '/'}
                            </span>
                          </td>
                          <td className="p-4 text-gray-400 font-mono">{formatBytes(f.fileSize || 0)}</td>
                          <td className="p-4 text-gray-400">
                            {new Date(f.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                            {!isTrash ? (
                              <>
                                <button
                                  onClick={() => handleDownloadFile(id)}
                                  className="p-1.5 bg-blue-900/30 text-blue-400 hover:bg-blue-900/60 rounded-lg transition-colors"
                                  title="Tải xuống tệp an toàn"
                                >
                                  <Download size={13} />
                                </button>
                                <button
                                  onClick={() => { setRenamingFile(f); setNewFileName(f.originalName); }}
                                  className="p-1.5 bg-gray-800 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                                  title="Đổi tên file"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={() => handleSoftDelete(id)}
                                  className="p-1.5 bg-amber-900/30 text-amber-400 hover:bg-amber-900/60 rounded-lg transition-colors"
                                  title="Chuyển vào thùng rác"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleRestore(id)}
                                  className="p-1.5 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/60 rounded-lg transition-colors"
                                  title="Khôi phục tệp"
                                >
                                  <Undo2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleHardDelete(id)}
                                  className="p-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/60 rounded-lg transition-colors"
                                  title="Xóa vĩnh viễn"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="p-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
                <span>
                  Trang {pagination.page} / {pagination.totalPages} ({pagination.totalCount} tệp)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => loadFiles(pagination.page - 1)}
                    className="px-3 py-1 bg-gray-950 hover:bg-gray-800 disabled:opacity-40 rounded-lg border border-gray-800"
                  >
                    Trước
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => loadFiles(pagination.page + 1)}
                    className="px-3 py-1 bg-gray-950 hover:bg-gray-800 disabled:opacity-40 rounded-lg border border-gray-800"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Tạo API Key mới</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Tên định danh (vd: Server Backup, Python Script)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleCreateKey}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Plus size={14} /> Tạo khóa
              </button>
            </div>

            {createdKey && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-emerald-400">Khóa mới đã được tạo thành công! Hãy lưu lại ngay vì khóa sẽ không hiển thị lại:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-950 p-2.5 rounded-lg text-xs font-mono text-white select-all border border-gray-800">
                    {createdKey.key}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdKey.key);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="p-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Keys List */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-950 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="p-4 font-semibold">Tên khóa</th>
                  <th className="p-4 font-semibold">Tiền tố</th>
                  <th className="p-4 font-semibold">Tạo lúc</th>
                  <th className="p-4 font-semibold">Lần dùng cuối</th>
                  <th className="p-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {apiKeys.map(k => (
                  <tr key={k._id} className="hover:bg-gray-850/50 transition-colors">
                    <td className="p-4 font-medium text-white">{k.name}</td>
                    <td className="p-4 font-mono text-gray-400">{k.keyPrefix}...</td>
                    <td className="p-4 text-gray-400">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-gray-400">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Chưa sử dụng'}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleRevokeKey(k._id)}
                        className="px-2.5 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/60 rounded-lg transition-colors text-[11px]"
                      >
                        Thu hồi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {renamingFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 size={16} className="text-cyan-400" /> Đổi tên tài liệu
            </h3>
            <p className="text-xs text-gray-400">
              Phần mở rộng ban đầu sẽ được bảo toàn tự động để đảm bảo an toàn tệp.
            </p>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenamingFile(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
