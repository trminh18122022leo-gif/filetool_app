import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Check, Sparkles, Zap, Shield } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'vĩnh viễn',
    description: 'Thích hợp cho nhu cầu xử lý cá nhân cơ bản hàng ngày.',
    features: [
      'Xử lý tối đa 25MB / file',
      '15 lượt xử lý / ngày',
      'Đầy đủ công cụ PDF & Image cơ bản',
      'Tự động xóa file sau 1 giờ',
    ],
    buttonText: 'Gói hiện tại',
    current: true,
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: '/ tháng',
    description: 'Dành cho chuyên viên xử lý tài liệu khối lượng vừa.',
    features: [
      'Xử lý file lên tới 100MB',
      '200 lượt xử lý / ngày',
      'Lưu trữ Cloudflare R2 (7 ngày)',
      'OCR Tiếng Việt & Tiếng Anh nâng cao',
      'Batch processing 20 files cùng lúc',
      'Tạo tối đa 3 API keys',
    ],
    buttonText: 'Nâng cấp Pro',
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$29.99',
    period: '/ tháng',
    description: 'Dành cho doanh nghiệp với nhu cầu tối đa và AI nâng cao.',
    features: [
      'Xử lý file lên tới 500MB',
      'Không giới hạn lượt xử lý',
      'Lưu trữ Cloudflare R2 (30 ngày)',
      'Tùy chọn Force Anthropic Claude AI',
      'Batch processing 50 files cùng lúc',
      'Tạo tối đa 10 API keys (10.000 req/ngày)',
      'Hỗ trợ ưu tiên 24/7',
    ],
    buttonText: 'Nâng cấp Business',
    highlight: false,
  },
];

export default function Pricing() {
  const isFreeMode = import.meta.env.VITE_HIDE_PRICING === 'true';
  const { user, token } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);

  const handleSubscribe = async (planId) => {
    if (planId === 'free') return;
    if (!user) {
      window.location.href = '/login';
      return;
    }

    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/payment/create-checkout-session', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ planName: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Khởi tạo thanh toán thất bại');

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-12 py-6">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Bảng giá linh hoạt & minh bạch</h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          Chọn gói phù hợp nhất với nhu cầu công việc của bạn. Hủy hoặc đổi gói bất cứ lúc nào.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {PLANS.map((p) => {
          const isCurrent = user?.plan === p.id;
          return (
            <div
              key={p.id}
              className={`relative p-8 rounded-3xl border flex flex-col justify-between transition-all duration-200 ${
                p.highlight
                  ? 'bg-gradient-to-b from-blue-950/60 to-gray-900 border-blue-500 shadow-2xl shadow-blue-950/50 scale-[1.02]'
                  : 'bg-gray-900/60 border-gray-800'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-full shadow">
                  Phổ biến nhất
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">{p.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">{p.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">{p.price}</span>
                  <span className="text-xs text-gray-400">{p.period}</span>
                </div>

                <ul className="space-y-3 text-xs text-gray-300">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check size={15} className="text-blue-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8">
                <button
                  onClick={() => handleSubscribe(p.id)}
                  disabled={isCurrent || loadingPlan === p.id}
                  className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md ${
                    isCurrent
                      ? 'bg-gray-800 text-gray-400 cursor-default'
                      : p.highlight
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  {loadingPlan === p.id ? 'Đang chuyển hướng...' : isCurrent ? 'Gói hiện tại' : p.buttonText}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
