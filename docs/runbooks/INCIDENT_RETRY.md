# Queue Incidents, Retries & Dead-Letter Runbook
**Sổ tay Xử lý Sự cố Vận hành & Phục hồi Hàng đợi (Incident Response Runbook)**  
**Phân hệ:** BullMQ Queue, Redis Failure Recovery, Worker OOM & Dead-Letter Reconciliation  
**Trạng thái:** ACTIVE OPERATIONAL RUNBOOK  
**Đối tượng:** On-Call Engineers, Site Reliability Engineers (SRE), System Administrators  
**Ngày cập nhật:** 23/10/2026  

---

## 1. Phân loại Lỗi: Tạm thời (Transient) vs Vĩnh viễn (Terminal)

Khi một tác vụ gặp lỗi trong hàng đợi, hệ thống áp dụng nguyên tắc phân loại nghiêm ngặt:

| Loại lỗi | Nguyên nhân điển hình | Chính sách xử lý | Số lần thử lại tối đa |
| :--- | :--- | :--- | :--- |
| **Transient (Tạm thời)** | Mạng chập chờn khi upload R2, Redis disconnect ngắn, CPU spike tạm thời | Tự động thử lại với Bounded Exponential Backoff | 3 lần (delay: 2s ➔ 4s ➔ 8s) |
| **Terminal (Vĩnh viễn)** | Tệp đầu vào hỏng cấu trúc, mật khẩu giải mã sai, định dạng không hỗ trợ | Đánh dấu `FAILED` ngay lập tức, hoàn trả quota, ghi log lỗi | 0 lần (Không thử lại vô ích) |
| **Process Crash (OOM)** | Worker bị hệ điều hành ngắt (Exit 137 / OOM) | BullMQ Stalled Check tự động nhặt lại sau 30 giây | Tối đa 2 lần trước khi chuyển Dead-Letter |

---

## 2. Quy trình Xử lý Sự cố Thường gặp

### Sự cố 1: Tác vụ bị ứ đọng trong hàng đợi (Queue Backlog Spike)
* **Dấu hiệu:** Số lượng job ở trạng thái `QUEUED` tăng đột biến, thời gian chờ p95 > 60 giây.
* **Các bước chẩn đoán:**
  1. Kiểm tra trạng thái `/ready` trên Web API: Xác nhận `queueBackend` có báo `bullmq-redis-ready` hay không.
  2. Kiểm tra tiến trình Background Worker: Xác nhận worker service trên Render có đang chạy không (`ps aux | grep worker.js`).
  3. Kiểm tra độ sâu hàng đợi trong Redis: `LLEN bull:filetools-jobs:wait`.
* **Hành động khắc phục:**
  1. Scale tăng số lượng instance Background Worker trên Render Dashboard (ví dụ từ 1 lên 2 hoặc 4 workers).
  2. Nếu có một job nặng chiếm trọn tài nguyên (như video 4K), truy vấn `jobId` và gọi `POST /api/jobs/:id/cancel` để giải phóng luồng xử lý.

---

### Sự cố 2: Worker bị Crash do tràn bộ nhớ (Out-Of-Memory / OOM Killer)
* **Dấu hiệu:** Tiến trình worker tự thoát với mã lỗi `137` hoặc `SIGKILL`.
* **Các bước xử lý:**
  1. Kiểm tra log của worker tại thời điểm crash để xác định `operation` và dung lượng tệp đầu vào (`fileSize`).
  2. Xác nhận thư mục tạm `uploads/jobs/:jobId/` của job bị crash có bị tồn dư không; chạy lệnh dọn dẹp khẩn cấp:
     ```bash
     npm run clean
     ```
  3. Điều chỉnh giảm mức đồng thời `WORKER_CONCURRENCY` trong môi trường Render (ví dụ từ `4` xuống `2`) để chia sẻ bớt gánh nặng RAM.

---

### Sự cố 3: Redis tạm thời mất kết nối (Redis Outage & Failover)
* **Dấu hiệu:** Web API log cảnh báo `⚠️ [Redis/Queue] Lỗi kết nối`.
* **Cơ chế tự bảo vệ:**
  - Hệ thống tự động chuyển sang chế độ dự phòng kép **Resilient In-Memory Fallback Dispatcher**, đảm bảo API không bị crash và người dùng vẫn gửi được tác vụ.
  - Sau khi Redis khôi phục, kết nối ioredis tự động tái lập (Auto-reconnect) mà không cần restart máy chủ.

---

## 3. Quy trình Đối soát Hàng đợi Chết (Dead-Letter Reconciliation)

Tất cả các job đã thử lại 3 lần thất bại sẽ được ghi nhận vào MongoDB với `status: 'FAILED'` để phục vụ đối soát định kỳ.

### Kịch bản chạy lệnh kiểm tra các job lỗi trong 24 giờ qua:
```javascript
// Scripts / Console command:
const JobRecord = require('./server/models/JobRecord');

async function checkFailedJobs() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const failedJobs = await JobRecord.find({
    status: 'FAILED',
    failedAt: { $gte: since }
  }).select('jobId user operation errors attempts');

  console.log(`Tìm thấy ${failedJobs.length} tác vụ thất bại cần xem xét:`);
  console.table(failedJobs.map(j => ({
    id: j.jobId,
    op: j.operation,
    user: j.user,
    attempts: j.attempts,
    lastError: j.errors?.[j.errors.length - 1]?.message?.slice(0, 50)
  })));
}
```

### Thử lại thủ công một tác vụ từ Dead-Letter:
1. Xác định nguyên nhân gốc (đã sửa lỗi hạ tầng hoặc cập nhật thư viện).
2. Gọi hàm `enqueueJob(jobRecord)` để đưa tác vụ trở lại hàng đợi mà không tính thêm quota của người dùng.
