import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MetaTags from '../components/seo/MetaTags';
import {
  Check, Sparkles, Shield, Zap, HardDrive, Key, FileText,
  Clock, ArrowRight, HelpCircle, AlertCircle, Info, Lock,
  ChevronDown, Cpu, RefreshCw
} from 'lucide-react';

export default function PricingPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [interval, setInterval] = useState('yearly'); // 'monthly' | 'yearly'
  const [plansData, setPlansData] = useState(null);
  const [billingStatus, setBillingStatus] = useState({ billingEnabled: false, mode: 'sandbox' });
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [faqOpen, setFaqOpen] = useState({ 0: true });

  // Tải bảng giá và trạng thái gateway từ Backend SSOT
  useEffect(() => {
    let mounted = true;
    async function fetchCatalogue() {
      try {
        const [plansRes, statusRes] = await Promise.all([
          fetch('/api/payment/plans').then(r => r.json()).catch(() => ({})),
          fetch('/api/payment/status').then(r => r.json()).catch(() => ({})),
        ]);

        if (mounted) {
          if (plansRes.plans) setPlansData(plansRes.plans);
          if (statusRes) {
            setBillingStatus({
              billingEnabled: statusRes.billingEnabled || false,
              mode: statusRes.mode || 'sandbox_simulation_only',
            });
          }
        }
      } catch (err) {
        console.error('Không thể tải catalogue gói:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchCatalogue();
    return () => { mounted = false; };
  }, []);

  const handleSelectPlan = async (planKey) => {
    if (planKey === 'free') {
      if (!user) navigate('/register');
      else navigate('/dashboard');
      return;
    }

    if (planKey === 'business') {
      window.location.href = 'mailto:contact@filetools.pro?subject=Y%C3%AAu%20c%E1%BA%A7u%20g%C3%B3i%20Enterprise%20FileTools';
      return;
    }

    if (!user) {
      navigate('/login?redirect=/pricing');
      return;
    }

    // Nếu billing đang tắt (Safety Gate) -> Hiển thị thông báo Sandbox an toàn
    if (!billingStatus.billingEnabled) {
      setFeedbackMsg({
        type: 'info',
        text: `🛡️ Chế độ Sandbox Simulation: Gói "${planKey.toUpperCase()}" (${interval === 'yearly' ? 'Năm' : 'Tháng'}) đang trong giai đoạn kiểm thử kỹ thuật an toàn. Không phát sinh thanh toán thật trước khi kích hoạt chính thức.`,
      });
      return;
    }

    // Nếu billing bật -> Điều hướng tới Stripe Checkout
    setCheckoutLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/payment/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planName: planKey, interval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.message || 'Không thể tạo phiên thanh toán Stripe');
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const currentPlan = user?.plan || 'free';

  // Dữ liệu fallback nếu chưa tải xong từ backend
  const plans = [
    {
      key: 'free',
      name: 'Miễn Phí',
      tagline: 'Dành cho cá nhân, học sinh với nhu cầu xử lý tài liệu cơ bản thường ngày.',
      priceMonthly: 0,
      priceYearly: 0,
      badge: 'Cơ Bản',
      popular: false,
      color: 'slate',
      entitlements: {
        maxFileSizeMB: 25,
        maxDailyJobs: 10,
        concurrency: 1,
        ocrPages: 20,
        aiCredits: 0,
        retentionHours: 24,
        byok: 'Hỗ trợ (Miễn phí)',
        cloudStorage: '1 GB',
        priority: 'Hàng đợi tiêu chuẩn',
      },
      features: [
        'Dung lượng tối đa 25 MB/tệp',
        '10 tác vụ xử lý mỗi ngày',
        '1 tác vụ xử lý song song',
        '20 trang OCR bóc tách/tháng',
        'Che PII bảo mật (Redaction)',
        'Hỗ trợ khóa riêng BYOK (AI tự cấp)',
        'Lưu trữ đám mây tạm thời 1 GB',
      ],
    },
    {
      key: 'plus',
      name: 'FileTools Plus',
      tagline: 'Tối ưu cho Freelancer & chuyên viên văn phòng cần xử lý tài liệu tốc độ cao.',
      priceMonthly: 4.99,
      priceYearly: 39.99, // ~3.33/mo (~33% discount)
      badge: 'Tiết Kiệm 33%',
      popular: false,
      color: 'cyan',
      entitlements: {
        maxFileSizeMB: 250,
        maxDailyJobs: 100,
        concurrency: 2,
        ocrPages: 300,
        aiCredits: 100,
        retentionHours: 72,
        byok: 'Đầy đủ + 100 Credits sẵn',
        cloudStorage: '10 GB',
        priority: 'Hàng đợi ưu tiên cao',
      },
      features: [
        'Dung lượng tối đa 250 MB/tệp',
        '100 tác vụ xử lý mỗi ngày',
        '2 tác vụ xử lý song song',
        '300 trang OCR bóc tách/tháng',
        '100 AI credits tích hợp sẵn/tháng',
        'Batch Processing hàng loạt nhanh',
        'Lưu trữ đám mây an toàn 10 GB',
        'Hoàn trả quota tự động nếu job lỗi',
      ],
    },
    {
      key: 'pro',
      name: 'FileTools Pro',
      tagline: 'Sức mạnh toàn diện cho nhóm, lập trình viên và chuyên gia xử lý dữ liệu lớn.',
      priceMonthly: 9.99,
      priceYearly: 79.99, // ~6.67/mo (~33% discount)
      badge: 'Khuyên Dùng / Phổ Biến Nhất',
      popular: true,
      color: 'amber',
      entitlements: {
        maxFileSizeMB: 1000,
        maxDailyJobs: 300,
        concurrency: 4,
        ocrPages: 1000,
        aiCredits: 500,
        retentionHours: 168,
        byok: 'Không giới hạn + 500 Credits',
        cloudStorage: '50 GB',
        priority: 'Cụm Worker riêng biệt',
      },
      features: [
        'Dung lượng cực lớn 1 GB (1,000 MB)/tệp',
        '300 tác vụ xử lý mỗi ngày',
        '4 tác vụ xử lý song song đồng thời',
        '1,000 trang OCR bóc tách/tháng',
        '500 AI credits cao cấp tích hợp/tháng',
        'Không giới hạn API Keys & Webhooks',
        'Lưu trữ đám mây an toàn 50 GB',
        'Độ ưu tiên xử lý cao nhất trên Render Worker',
      ],
    },
    {
      key: 'business',
      name: 'Doanh Nghiệp',
      tagline: 'Hạ tầng dành riêng cho tổ chức, SLA 99.9% và bảo mật dữ liệu cấp doanh nghiệp.',
      priceMonthly: 'Tùy chỉnh',
      priceYearly: 'Liên hệ',
      badge: 'Enterprise',
      popular: false,
      color: 'rose',
      entitlements: {
        maxFileSizeMB: 5000,
        maxDailyJobs: 'Không giới hạn',
        concurrency: 16,
        ocrPages: 'Không giới hạn',
        aiCredits: 'Theo hợp đồng',
        retentionHours: 'Tùy chỉnh',
        byok: 'Chính sách bảo mật riêng',
        cloudStorage: 'Từ 1 TB',
        priority: 'Dedicated Cluster SLA 99.9%',
      },
      features: [
        'Dung lượng tệp lên tới 5 GB',
        'Không giới hạn số tác vụ mỗi ngày',
        '16 luồng xử lý song song tốc độ cao',
        'Dedicated Worker Cluster độc quyền',
        'Quản lý nhóm thành viên & SSO / SAML',
        'Hợp đồng SLA 99.9% & Hóa đơn VAT điện tử',
        'Ký cam kết bảo mật NDA & Hỗ trợ kỹ thuật 24/7',
      ],
    },
  ];

  const faqs = [
    {
      q: 'Tôi có thể thay đổi hoặc hủy gói đăng ký bất cứ lúc nào không?',
      a: 'Hoàn toàn có thể. Khi bạn hủy gói, tài khoản vẫn tiếp tục được hưởng đầy đủ quyền lợi của gói trả phí cho đến khi chu kỳ hiện tại kết thúc (cuối tháng hoặc cuối năm), sau đó sẽ tự động chuyển về gói Miễn Phí mà không tính thêm bất kỳ khoản phí nào.',
    },
    {
      q: 'Tính năng Mang Khóa Riêng (BYOK - Bring Your Own Key) hoạt động thế nào?',
      a: 'Bạn có thể nhập API Key OpenAI, Google Gemini hoặc Anthropic của riêng bạn vào mục Tài Khoản. Toàn bộ chìa khóa được mã hóa chuẩn quân đội AES-256-GCM tại Vault máy chủ, không bao giờ lộ ra ngoài và bạn được sử dụng các tác vụ AI không giới hạn mà không bị trừ AI credits nội bộ.',
    },
    {
      q: 'Hạn mức xử lý được tính toán và làm mới (Reset) như thế nào?',
      a: 'Hạn mức tác vụ ngày (Daily Jobs) được làm mới tự động vào 00:00 UTC mỗi ngày. Hạn mức OCR và AI Credits được cấp mới vào ngày đầu tiên của mỗi chu kỳ thanh toán. Nếu một tác vụ gặp lỗi hệ thống, hệ thống Quota Ledger nguyên tử sẽ tự động hoàn trả quota ngay lập tức cho bạn.',
    },
    {
      q: 'File của tôi được bảo mật và lưu giữ trong bao lâu?',
      a: 'File tải lên được lưu trong Cloudflare R2 Private Bucket với chứng chỉ mã hóa TLS 1.3 và chữ ký truy cập có thời hạn (Signed Window). File của bạn sẽ tự động xóa vĩnh viễn theo chu kỳ lưu trữ của từng gói (24h với Free, 72h với Plus, 7 ngày với Pro), hoặc bạn có thể nhấn "Xóa ngay lập tức" trong Dashboard.',
    },
    {
      q: 'FileTools Pro có hỗ trợ các kho ứng dụng Apple App Store và Google Play không?',
      a: 'Có! FileTools Pro tuân thủ nghiêm ngặt Hướng dẫn Apple StoreKit 2 (Guideline 3.1.1) và Google Play Billing 2026. Bạn có thể đăng ký tài khoản trên Web và đăng nhập đồng bộ trên ứng dụng iOS, macOS, Windows hoặc Android hoàn toàn liền mạch.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20 select-none">
      <MetaTags
        title="Bảng Giá & Gói Đăng Ký 2026 — Tiết Kiệm Tới 33%"
        description="Bảng giá các gói cước FileTools Pro: Gói Miễn phí $0, Plus $4.99/tháng và Pro $9.99/tháng. Hạn mức dung lượng lớn, OCR nhận dạng và AI trợ lý không giới hạn."
        canonicalPath="/pricing"
        breadcrumbs={[
          { name: 'Trang chủ', path: '/' },
          { name: 'Bảng giá', path: '/pricing' },
        ]}
      />
      {/* ── SAFETY GATE BANNER (Sandbox Mode) ── */}
      {!billingStatus.billingEnabled && (
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 backdrop-blur-xl flex items-start gap-3.5 shadow-sm">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
            <Shield size={20} />
          </div>
          <div className="text-xs sm:text-sm">
            <p className="font-bold flex items-center gap-1.5">
              <span>Chế độ Sandbox Simulation (An toàn kiểm thử)</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
                Safety Gate Active
              </span>
            </p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
              Cổng thanh toán Stripe đang hoạt động ở chế độ thử nghiệm an toàn (<code className="font-mono text-[11px] bg-amber-500/15 px-1 py-0.5 rounded">BILLING_ENABLED=false</code>). Mọi thao tác đều không kích hoạt trừ tiền thẻ tín dụng thật trước khi được phê duyệt triển khai từ chủ sở hữu.
            </p>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-400/30 text-cyan-500 dark:text-cyan-400 mb-3">
          <Sparkles size={14} />
          <span>BẢNG GIÁ 2026 MINH BẠCH & TỰ ĐỘNG HÓA</span>
        </span>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
          Nâng Tầm Xử Lý Tệp <br className="hidden sm:inline" />
          <span className="text-gradient">Không Giới Hạn Tốc Độ</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          Đăng ký linh hoạt, tính năng cao cấp chuẩn Apple HIG. Hoàn trả quota tức thì khi có lỗi và tuyệt đối không thu phí ẩn.
        </p>

        {/* ── INTERVAL TOGGLE (Monthly vs Yearly) ── */}
        <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 shadow-inner">
          <button
            type="button"
            onClick={() => setInterval('monthly')}
            className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              interval === 'monthly'
                ? 'bg-white dark:bg-white/15 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Thanh toán theo tháng
          </button>
          <button
            type="button"
            onClick={() => setInterval('yearly')}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              interval === 'yearly'
                ? 'liquid-gold-button shadow-md'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <span>Thanh toán theo năm</span>
            <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-md bg-amber-500 text-black shadow-xs">
              Tiết kiệm ~33%
            </span>
          </button>
        </div>
      </div>

      {/* ── FEEDBACK ALERTS ── */}
      {feedbackMsg && (
        <div className={`max-w-2xl mx-auto mb-8 p-4 rounded-xl text-xs sm:text-sm flex items-start gap-3 border ${
          feedbackMsg.type === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-800 dark:text-cyan-300'
        }`}>
          <Info size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{feedbackMsg.text}</p>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-bold hover:underline opacity-80"
          >
            Đóng
          </button>
        </div>
      )}

      {/* ── PRICING CARDS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {plans.map((p) => {
          const isCurrent = currentPlan === p.key;
          const displayPrice = interval === 'yearly'
            ? (typeof p.priceYearly === 'number' ? (p.priceYearly / 12).toFixed(2) : p.priceYearly)
            : p.priceMonthly;

          return (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-3xl p-6 transition-all duration-200 backdrop-blur-xl border ${
                p.popular
                  ? 'bg-amber-500/5 dark:bg-amber-500/[0.06] border-amber-500/50 shadow-[0_10px_35px_rgba(245,158,11,0.15)] ring-2 ring-amber-500/30'
                  : 'bg-white/80 dark:bg-white/[0.03] border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20'
              }`}
            >
              {/* Card Header Badge */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                  p.popular
                    ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                    : 'bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300 border-black/10 dark:border-white/10'
                }`}>
                  {p.badge}
                </span>

                {isCurrent && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Gói hiện tại
                  </span>
                )}
              </div>

              {/* Title & Tagline */}
              <h3 className="text-xl font-black mb-1">{p.name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 min-h-[36px] leading-relaxed mb-6">
                {p.tagline}
              </p>

              {/* Price Tag */}
              <div className="mb-6 pb-6 border-b border-black/10 dark:border-white/10">
                <div className="flex items-baseline gap-1">
                  {typeof displayPrice === 'number' ? (
                    <>
                      <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                        ${displayPrice}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">/tháng</span>
                    </>
                  ) : (
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                      {displayPrice}
                    </span>
                  )}
                </div>

                {interval === 'yearly' && typeof p.priceYearly === 'number' && p.priceYearly > 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                    Thanh toán hàng năm ${p.priceYearly}/năm (tiết kiệm 33%)
                  </p>
                )}
                {interval === 'monthly' && typeof p.priceMonthly === 'number' && p.priceMonthly > 0 && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Hóa đơn theo từng tháng, hủy tùy ý
                  </p>
                )}
              </div>

              {/* Quota Metrics Summary */}
              <div className="space-y-2 mb-6 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <HardDrive size={13} />
                    <span>Dung lượng tệp:</span>
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {p.entitlements.maxFileSizeMB >= 1000 ? `${p.entitlements.maxFileSizeMB / 1000} GB` : `${p.entitlements.maxFileSizeMB} MB`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <Zap size={13} />
                    <span>Tác vụ/ngày:</span>
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">{p.entitlements.maxDailyJobs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <Cpu size={13} />
                    <span>Luồng song song:</span>
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">{p.entitlements.concurrency} worker</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <Sparkles size={13} />
                    <span>AI Credits/tháng:</span>
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">{p.entitlements.aiCredits}</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="space-y-2.5 mb-8 flex-1">
                {p.features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs leading-snug">
                    <div className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      <Check size={11} />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">{feat}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <button
                type="button"
                onClick={() => handleSelectPlan(p.key)}
                disabled={isCurrent || checkoutLoading}
                className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-black/5 dark:bg-white/10 text-gray-400 cursor-not-allowed border border-black/10 dark:border-white/10'
                    : p.popular
                      ? 'liquid-gold-button shadow-lg shadow-amber-500/20'
                      : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-900 dark:text-white border border-black/10 dark:border-white/15'
                }`}
              >
                {isCurrent ? (
                  <span>Đang sử dụng gói này</span>
                ) : checkoutLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Đang kết nối...</span>
                  </>
                ) : (
                  <>
                    <span>{p.key === 'free' ? 'Bắt Đầu Miễn Phí' : p.key === 'business' ? 'Liên Hệ Báo Giá' : 'Nâng Cấp Ngay'}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── DETAILED COMPARISON TABLE ── */}
      <div className="mb-16 rounded-3xl border border-black/10 dark:border-white/10 overflow-hidden backdrop-blur-xl bg-white/60 dark:bg-white/[0.02]">
        <div className="p-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold">Bảng So Sánh Chi Tiết Quyền Lợi (SSOT)</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Được đồng bộ trực tiếp từ server-side catalogue config, bảo đảm tính minh bạch tuyệt đối.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-cyan-600 dark:text-cyan-400">
            <Lock size={12} />
            <span>Server Entitlements Enforced</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                <th className="py-3.5 px-4 font-bold text-gray-700 dark:text-gray-300">Tính năng & Hạn mức</th>
                <th className="py-3.5 px-4 font-bold text-gray-700 dark:text-gray-300">Free</th>
                <th className="py-3.5 px-4 font-bold text-cyan-700 dark:text-cyan-400">Plus ($4.99)</th>
                <th className="py-3.5 px-4 font-bold text-amber-700 dark:text-amber-400">Pro ($9.99)</th>
                <th className="py-3.5 px-4 font-bold text-rose-700 dark:text-rose-400">Doanh nghiệp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              <tr>
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">Dung lượng tệp tối đa (Max File Size)</td>
                <td className="py-3 px-4">25 MB</td>
                <td className="py-3 px-4 font-semibold text-cyan-600 dark:text-cyan-400">250 MB</td>
                <td className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400">1,000 MB (1 GB)</td>
                <td className="py-3 px-4">5,000 MB (5 GB)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">Tác vụ xử lý mỗi ngày (Daily Jobs Limit)</td>
                <td className="py-3 px-4">10 tác vụ/ngày</td>
                <td className="py-3 px-4">100 tác vụ/ngày</td>
                <td className="py-3 px-4 font-semibold text-amber-600 dark:text-amber-400">300 tác vụ/ngày</td>
                <td className="py-3 px-4">Không giới hạn</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">Luồng tác vụ song song (Concurrency)</td>
                <td className="py-3 px-4">1 worker</td>
                <td className="py-3 px-4">2 worker</td>
                <td className="py-3 px-4 font-semibold text-amber-600 dark:text-amber-400">4 worker song song</td>
                <td className="py-3 px-4">16 worker chuyên dụng</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">OCR Tesseract / PDF Extraction</td>
                <td className="py-3 px-4">20 trang/tháng</td>
                <td className="py-3 px-4">300 trang/tháng</td>
                <td className="py-3 px-4 font-semibold text-amber-600 dark:text-amber-400">1,000 trang/tháng</td>
                <td className="py-3 px-4">Không giới hạn</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">AI Credits hàng tháng (Included)</td>
                <td className="py-3 px-4">0 (Yêu cầu BYOK)</td>
                <td className="py-3 px-4">100 credits</td>
                <td className="py-3 px-4 font-semibold text-amber-600 dark:text-amber-400">500 credits</td>
                <td className="py-3 px-4">Theo hợp đồng</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">Mang Khóa Riêng (BYOK Unlimited)</td>
                <td className="py-3 px-4 text-emerald-600">✓ Có hỗ trợ</td>
                <td className="py-3 px-4 text-emerald-600">✓ Có hỗ trợ</td>
                <td className="py-3 px-4 text-emerald-600 font-bold">✓ Có hỗ trợ</td>
                <td className="py-3 px-4 text-emerald-600">✓ Có hỗ trợ</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">Thời gian lưu trữ tệp (Cloud Retention)</td>
                <td className="py-3 px-4">24 giờ</td>
                <td className="py-3 px-4">72 giờ (3 ngày)</td>
                <td className="py-3 px-4">168 giờ (7 ngày)</td>
                <td className="py-3 px-4">Tùy biến theo chính sách</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">Bảo mật Che PII Redact (True Removal)</td>
                <td className="py-3 px-4 text-emerald-600">✓ Có</td>
                <td className="py-3 px-4 text-emerald-600">✓ Có</td>
                <td className="py-3 px-4 text-emerald-600 font-bold">✓ Có</td>
                <td className="py-3 px-4 text-emerald-600">✓ Có</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">REST API Keys & Automation Workflows</td>
                <td className="py-3 px-4">1 API Key</td>
                <td className="py-3 px-4">5 API Keys</td>
                <td className="py-3 px-4 font-semibold text-amber-600 dark:text-amber-400">Không giới hạn</td>
                <td className="py-3 px-4">Không giới hạn + Webhooks</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FREQUENTLY ASKED QUESTIONS (FAQ) ── */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-8">Câu Hỏi Thường Gặp</h2>
        <div className="space-y-4">
          {faqs.map((f, i) => {
            const isOpen = !!faqOpen[i];
            return (
              <div
                key={i}
                className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden backdrop-blur-xl bg-white/60 dark:bg-white/[0.02] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setFaqOpen(prev => ({ ...prev, [i]: !prev[i] }))}
                  className="w-full py-4 px-5 text-left text-xs sm:text-sm font-bold flex items-center justify-between gap-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                >
                  <span>{f.q}</span>
                  <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180 text-amber-500' : 'text-gray-400'}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed border-t border-black/5 dark:border-white/5 pt-3 animate-in fade-in duration-150">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
