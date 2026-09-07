import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Folder, Key, CreditCard, Download, Trash2,
  Plus, Copy, Check, Sparkles, HardDrive, Zap, Home
} from 'lucide-react';
import { formatBytes } from '../utils/fileHelpers';

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('files');

  const [files, setFiles]         = useState([]);
  const [apiKeys, setApiKeys]     = useState([]);
  const [usage, setUsage]         = useState(null);
  const [loading, setLoading]     = useState(true);

  // New API Key modal state
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey]   = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  const loadData = async () => {
    setLoading(true);
    try {
      const [filesRes, keysRes, usageRes] = await Promise.all([
        fetch('/api/user/files', { headers: authHeader }).then(r => r.json()),
        fetch('/api/apikey',     { headers: authHeader }).then(r => r.json()),
        fetch('/api/user/usage', { headers: authHeader }).then(r => r.json()),
      ]);

      if (filesRes.files) setFiles(filesRes.files);
      if (keysRes.keys)   setApiKeys(keysRes.keys);
      if (usageRes)       setUsage(usageRes);
    } catch (err) {
      console.error('Lỗi tải dữ liệu dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  const handleCreateKey = async () => {
    try {
      const res = await fetch('/api/apikey', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body:    JSON.stringify({ name: newKeyName || 'API Key' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCreatedKey(data.apiKey);
      setNewKeyName('');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteFile = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa file này khỏi Cloud R2?')) return;
    try {
      await fetch(`/api/user/files/${id}`, { method: 'DELETE', headers: authHeader });
      setFiles(files.filter(f => f._id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownloadFile = async (id) => {
    try {
      const res = await fetch(`/api/storage/download/${id}`, { headers: authHeader });
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!confirm('Bạn có chắc muốn vô hiệu hóa API key này?')) return;
    try {
      await fetch(`/api/apikey/${id}`, { method: 'DELETE', headers: authHeader });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-gray-900 border border-blue-800/40 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Xin chào, {user?.name || 'Bạn'}!
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            Gói hiện tại: <span className="text-blue-400 font-bold uppercase">{user?.plan || 'Free'}</span> · Quản lý tập trung file lưu trữ và API key.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-gray-700"
          >
            <Home size={14} /> Trang chủ
          </button>

          {user?.plan === 'free' && (
            <a
              href="/pricing"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-purple-900/40 shrink-0"
            >
              <Sparkles size={14} /> Nâng cấp Pro
            </a>
          )}
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
              {usage?.dailyUsage?.count || 0} <span className="text-xs font-normal text-gray-500">file đã xử lý</span>
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'files'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-900'
          }`}
        >
          <Folder size={14} /> File trên Cloud ({files.length})
        </button>

        <button
          onClick={() => setActiveTab('keys')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'keys'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-900'
          }`}
        >
          <Key size={14} /> Quản lý API Key ({apiKeys.length})
        </button>
      </div>

      {/* Files Tab */}
      {activeTab === 'files' && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
          {files.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-2">
              <Folder size={32} className="mx-auto text-gray-600" />
              <p className="text-sm">Chưa có file nào được lưu trên Cloud.</p>
              <p className="text-xs">Khi đăng nhập và xử lý file, kết quả sẽ tự động lưu lại đây.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-950 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="p-4 font-semibold">Tên file</th>
                    <th className="p-4 font-semibold">Thao tác</th>
                    <th className="p-4 font-semibold">Dung lượng</th>
                    <th className="p-4 font-semibold">Hạn lưu trữ</th>
                    <th className="p-4 font-semibold text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {files.map(f => (
                    <tr key={f._id} className="hover:bg-gray-850/50 transition-colors">
                      <td className="p-4 font-medium text-white max-w-[200px] truncate">{f.originalName}</td>
                      <td className="p-4 text-gray-400">{f.operation || 'Xử lý'}</td>
                      <td className="p-4 text-gray-400">{formatBytes(f.fileSize)}</td>
                      <td className="p-4 text-gray-400">{new Date(f.expiresAt).toLocaleDateString()}</td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleDownloadFile(f._id)}
                          className="p-1.5 bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 rounded-lg transition-colors"
                          title="Tải xuống"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteFile(f._id)}
                          className="p-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          {/* Create Key Box */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Tạo API Key mới</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Tên gợi nhớ (VD: My Production App)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white"
              />
              <button
                onClick={handleCreateKey}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/30 transition-all"
              >
                <Plus size={14} /> Tạo Key
              </button>
            </div>

            {createdKey && (
              <div className="p-4 bg-yellow-950/40 border border-yellow-800/60 rounded-xl space-y-2">
                <p className="text-xs text-yellow-300 font-bold">⚠️ Hãy copy API key này ngay! Bạn sẽ không thể xem lại.</p>
                <div className="flex items-center justify-between bg-black/50 p-2.5 rounded-lg border border-yellow-800/40 font-mono text-xs text-yellow-200">
                  <span className="truncate max-w-[400px]">{createdKey}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdKey);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-200 ml-2 shrink-0"
                  >
                    {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Keys List */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
            {apiKeys.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                Chưa có API key nào. Tạo key để tích hợp FileTools Pro vào ứng dụng của bạn.
              </div>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {apiKeys.map(k => (
                  <div key={k._id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-white">{k.name}</h4>
                      <p className="font-mono text-[11px] text-gray-500 mt-0.5">{k.keyPrefix} · Hạn mức: {k.rateLimitPerDay} req/ngày</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                        k.status === 'active' ? 'bg-green-950 text-green-300 border-green-800' : 'bg-red-950 text-red-300 border-red-800'
                      }`}>
                        {k.status}
                      </span>
                      {k.status === 'active' && (
                        <button
                          onClick={() => handleRevokeKey(k._id)}
                          className="text-xs text-red-400 hover:text-red-300 hover:underline"
                        >
                          Thu hồi
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
