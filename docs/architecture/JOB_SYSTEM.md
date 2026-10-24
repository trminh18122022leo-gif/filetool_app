# Distributed Job System & Worker Architecture
**Tài liệu Thiết kế Hệ thống Tác vụ Phân tán & Đảm bảo Tính Ổn định (Reliability Engineering)**  
**Phân hệ:** BullMQ Queue, Managed Redis/Valkey & Render Background Workers  
**Trạng thái:** ACTIVE PRODUCTION ARCHITECTURE  
**Ngày cập nhật:** 23/10/2026  

---

## 1. Bối cảnh & Mục tiêu Kiến trúc

Trước đây, hệ thống xử lý các tác vụ nặng (Batch, chuyển đổi PDF/Office, nén, OCR, AI) trực tiếp bên trong tiến trình web Express (in-process `p-queue` hoặc Promise không đồng bộ). Khi triển khai trên môi trường đám mây như Render Web Service:
1. **Render Container Recycling:** Render có thể tái khởi động, deploy lại hoặc tự động scale down container web bất cứ lúc nào, khiến các tác vụ đang chạy bị ngắt giữa chừng, mất trạng thái, rò rỉ file tạm và mất quota người dùng.
2. **CPU Starvation:** Các tác vụ nặng ngốn 100% CPU của tiến trình Node.js, khiến các request HTTP khác bị nghẽn (Event Loop lag) và làm tăng độ trễ p99 của API.

**Giải pháp:** Tách biệt triệt để tầng HTTP API và tầng Background Worker thông qua hàng đợi phân tán bền vững (Durable Message Queue) với BullMQ và Redis/Valkey.

```
[ Client / Browser ]
         │
         │ (1) POST /api/jobs (Idempotency-Key)
         ▼
┌────────────────────────────────────────────────────────┐
│  RENDER WEB SERVICE (HTTP API)                         │
│  - Validate schema & Multi-tenant ACL                 │
│  - Atomic Quota Reservation (server-side)             │
│  - Save JobRecord (MongoDB: Status = 'QUEUED')        │
│  - Push Job payload to BullMQ                         │
└────────────────────────────────────────────────────────┘
         │
         ▼ (2) Enqueue Job
┌────────────────────────────────────────────────────────┐
│  REDIS / VALKEY (Managed Durability Layer)             │
│  - BullMQ Queue: 'filetools-jobs'                     │
│  - AOF (appendonly yes, appendfsync everysec)          │
│  - No-Eviction Policy                                  │
└────────────────────────────────────────────────────────┘
         │
         ▼ (3) Pop & Lock Job (Concurrency Classes)
┌────────────────────────────────────────────────────────┐
│  RENDER BACKGROUND WORKER (server/worker.js)           │
│  - Isolated Per-Job Sandbox (uploads/jobs/:jobId/)     │
│  - Progress updates via WebSocket / DB Polling         │
│  - Atomic Quota Commit on Success                      │
│  - Atomic Quota Refund on Failure/Cancel               │
│  - Graceful Shutdown (SIGTERM / SIGINT)                │
└────────────────────────────────────────────────────────┘
```

---

## 2. Cấu hình Bền vững của Redis / Valkey (Durability & Failure Modes)

Để đảm bảo tác vụ không bị mất khi Redis hoặc máy chủ khởi động lại, cấu hình Redis/Valkey bắt buộc phải tuân theo các chỉ thị sau:

### 2.1 Cấu hình Bắt buộc (Production Settings)
```conf
# 1. Bật ghi nhật ký AOF (Append-Only File) để đảm bảo độ bền vững dữ liệu
appendonly yes
appendfsync everysec

# 2. Ngăn chặn Redis tự ý xóa dữ liệu khi bộ nhớ đầy
maxmemory-policy noeviction

# 3. Timeout và Reconnection
timeout 0
tcp-keepalive 300
```

### 2.2 Phân tích Các Chế độ Thất bại (Failure Modes & Mitigations)

| Kịch bản Thất bại | Hậu quả tiềm ẩn | Cơ chế Phòng vệ & Khắc phục |
| :--- | :--- | :--- |
| **API Web khởi động lại** | Mất job đang chạy nếu lưu in-memory | Job đã được lưu trong MongoDB (`JobRecord`) và Redis Queue; API mới khởi động chỉ việc truy vấn DB |
| **Worker bị Kill (SIGKILL / OOM)** | Job bị treo ở trạng thái `PROCESSING` | BullMQ Lock Renewal (stalled job check) tự động phát hiện và re-queue job sau 30 giây |
| **Redis tạm thời mất kết nối** | Không thể đẩy hoặc nhận job | Bounded Exponential Backoff (reconnect trong 200ms - 3000ms); Chế độ Resilient In-Memory Fallback tự động duy trì hoạt động |
| **Bộ nhớ Redis bị đầy (Memory Pressure)** | Lỗi Out of Memory | Cấu hình `noeviction` ngăn chặn mất job; Alert cảnh báo bộ nhớ vượt ngưỡng 80% |

---

## 3. Phân lớp Tài nguyên & Giới hạn Đồng thời (Concurrency Classes)

Mỗi loại tác vụ có mức độ tiêu hao CPU và RAM khác nhau. Worker phân loại tác vụ thành 5 nhóm độc lập (`server/queue/jobProcessors.js`):

| Nhóm tác vụ (Class) | Thao tác đại diện | Mức đồng thời (Concurrency) | Timeout tối đa | Bộ nhớ cấp phát |
| :--- | :--- | :--- | :--- | :--- |
| **PDF** | `pdf-compress`, `pdf-merge`, `pdf-redact` | 4 workers | 60 giây | 512 MB |
| **Office** | `pdf-to-word`, `word-to-pdf` | 2 workers | 120 giây | 1024 MB |
| **OCR** | `scan-to-pdf`, `image-ocr` | 2 workers | 90 giây | 1024 MB |
| **Media** | `video-transcode`, `audio-tts` | 2 workers | 300 giây | 1536 MB |
| **AI** | `remove-bg`, `inpaint`, `ai-analysis` | 3 workers | 60 giây | 1024 MB |

---

## 4. Cô lập Sandbox & Chống Rò rỉ Chéo (Zero Cross-Tenant Leakage)

Mỗi tác vụ được thực thi trong một thư mục tạm riêng biệt:  
`uploads/jobs/${jobId}/`

1. Các file trung gian (ảnh raster, trang tạm, file gộp) chỉ được tạo và lưu trong thư mục này.
2. Khối `finally` trong `jobProcessors.js` luôn đảm bảo gọi `fs.rmSync(jobSandboxDir, { recursive: true, force: true })`, bất kể tác vụ thành công hay thất bại.
3. Không một người dùng nào có thể truy cập hoặc nhìn thấy file tạm của người dùng khác.

---

## 5. Vòng đời Trạng thái Tác vụ (Job Lifecycle State Machine)

```
[ CLIENT REQUEST ]
        │
        ▼
   (INITIATED) ──► Kiểm tra Idempotency & Schema
        │
        ▼
   (RESERVED)  ──► Đặt trước Quota nguyên tử ($inc: 1)
        │
        ▼
    (QUEUED)   ──► Đẩy payload vào BullMQ / Dispatcher
        │
        ▼
  (PROCESSING) ──► Worker nhận job, tạo Sandbox, xử lý
        │
   ┌────┴──────────────────────────┐
   ▼                               ▼
(COMPLETED)                     (FAILED / CANCELLED)
   │                               │
   ├─► Commit Quota                ├─► Refund Quota nguyên tử
   └─► Ready for Download          └─► Ghi nhận mã lỗi & dọn dẹp
```

---

## 6. Dừng Tiến trình An toàn (Graceful Shutdown)

Khi Render gửi tín hiệu `SIGTERM` hoặc `SIGINT` tới Background Worker:
1. Worker ngừng nhận các job mới từ hàng đợi (`worker.pause()`).
2. Chờ tối đa 15 giây để các tác vụ đang thực thi dở dang hoàn tất (`worker.close()`).
3. Nếu quá 15 giây, ngắt kết nối an toàn với Redis và MongoDB.
4. Thoát tiến trình với mã exit 0, cho phép container thay thế tiếp quản.
