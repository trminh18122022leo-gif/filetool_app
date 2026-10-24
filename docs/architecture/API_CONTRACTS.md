# Distributed Jobs & Health API Specification
**Tài liệu Quy chuẩn Đặc tả Hợp đồng Giao diện Lập trình (API Contract Specification)**  
**Phân hệ:** Job Management, Health & Observability Endpoints  
**Trạng thái:** ACTIVE API SPECIFICATION v1.0  
**Ngày cập nhật:** 23/10/2026  

---

## 1. POST /api/jobs — Khởi tạo tác vụ không đồng bộ (Create Job)

Tạo một tác vụ xử lý tệp tin đưa vào hàng đợi phân tán. Hỗ trợ tiêu đề `Idempotency-Key` để ngăn ngừa việc tạo trùng lặp hoặc trừ phí 2 lần khi trình duyệt gửi lại hoặc mạng chập chờn.

### Request Headers
| Header | Bắt buộc | Định dạng / Mô tả |
| :--- | :--- | :--- |
| `Authorization` | Không | `Bearer <JWT_ACCESS_TOKEN>` (Nếu đã đăng nhập) |
| `Idempotency-Key` | Khuyến nghị | Chuỗi định danh duy nhất (UUIDv4 hoặc hash của request) |
| `Content-Type` | Có | `multipart/form-data` hoặc `application/json` |

### Request Body
```json
{
  "operation": "pdf-compress",
  "params": {
    "quality": "ebook"
  },
  "fileIds": ["507f1f77bcf86cd799439011"]
}
```
*(Nếu gửi qua multipart/form-data, có thể đính kèm trực tiếp danh sách tệp qua trường `files`)*

### Danh sách `operation` hợp lệ
`pdf-compress`, `pdf-merge`, `pdf-split`, `pdf-to-word`, `word-to-pdf`, `pdf-redact`, `batch-process`, `image-convert`, `image-compress`, `image-resize`, `html-to-pdf`.

### Response 201 Created (Tạo mới thành công)
```json
{
  "success": true,
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "jobSecret": "sec-xyz123...", // Chỉ trả về cho khách vãng lai
  "status": "QUEUED",
  "operation": "pdf-compress",
  "operationClass": "pdf",
  "queueEngine": "bullmq-redis",
  "checkStatusUrl": "/api/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cancelUrl": "/api/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/cancel",
  "createdAt": "2026-10-23T11:20:00.000Z",
  "idempotentReplay": false
}
```

### Response 200 OK (Idempotent Replay - Gửi lại cùng Idempotency-Key)
```json
{
  "success": true,
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "PROCESSING",
  "operation": "pdf-compress",
  "checkStatusUrl": "/api/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "cancelUrl": "/api/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/cancel",
  "idempotentReplay": true,
  "message": "Tác vụ đã được tạo trước đó với Idempotency-Key này"
}
```

### Response 429 Too Many Requests (Hết hạn mức Quota)
```json
{
  "error": "Bạn đã sử dụng hết hạn mức hàng ngày (15/15 lượt). Vui lòng nâng cấp gói Pro/Business.",
  "code": "DAILY_QUOTA_EXHAUSTED",
  "plan": "free"
}
```

---

## 2. GET /api/jobs/:id — Tra cứu tiến độ & Kết quả (Poll Status)

Hỗ trợ kiểm tra tiến độ định kỳ (HTTP Polling) làm cơ chế dự phòng khi WebSocket bị ngắt kết nối.

### Request Headers
| Header | Mô tả |
| :--- | :--- |
| `Authorization` | `Bearer <JWT_ACCESS_TOKEN>` (cho thành viên) |
| `x-job-secret` | Cung cấp `jobSecret` đã cấp nếu là khách vãng lai |

### Response 200 OK (Đang xử lý)
```json
{
  "success": true,
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "operation": "pdf-compress",
  "operationClass": "pdf",
  "status": "PROCESSING",
  "progress": 65,
  "currentStep": "Đang tối ưu hoá luồng dữ liệu",
  "outputFile": null,
  "createdAt": "2026-10-23T11:20:00.000Z",
  "startedAt": "2026-10-23T11:20:02.000Z"
}
```

### Response 200 OK (Hoàn tất)
```json
{
  "success": true,
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "COMPLETED",
  "progress": 100,
  "currentStep": "Hoàn tất tác vụ",
  "outputFile": {
    "fileId": "out-789",
    "originalName": "compressed_document.pdf",
    "fileSize": 145020,
    "mimeType": "application/pdf",
    "downloadUrl": "/api/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890/download-intent"
  },
  "completedAt": "2026-10-23T11:20:15.000Z"
}
```

### Response 403 Forbidden (Tenant Boundary Violation)
```json
{
  "error": "Bạn không có quyền xem thông tin tác vụ này",
  "code": "FORBIDDEN_JOB_ACCESS"
}
```

---

## 3. POST /api/jobs/:id/cancel — Hủy bỏ tác vụ (Cancel Job)

Cho phép người sở hữu hủy tác vụ đang chờ xử lý hoặc đang thực thi. Quota đã đặt trước sẽ được hoàn trả ngay lập tức.

### Response 200 OK
```json
{
  "success": true,
  "message": "Tác vụ đã được hủy thành công",
  "status": "CANCELLED",
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

## 4. GET /api/jobs/:id/download-intent — Quyền tải kết quả an toàn

Cấp phát URL có chữ ký ngắn hạn (Signed URL, hiệu lực 15 phút) sau khi kiểm tra nghiêm ngặt quyền sở hữu tệp tin.

### Response 200 OK
```json
{
  "success": true,
  "fileId": "out-789",
  "filename": "compressed_document.pdf",
  "downloadUrl": "/outputs/compressed_document.pdf?token=eyJh...",
  "expiresInSeconds": 900
}
```

---

## 5. Health & Observability Endpoints

| Endpoint | Mục đích | Mã phản hồi |
| :--- | :--- | :--- |
| `GET /live` | Liveness probe (Tiến trình Node.js còn sống) | `200 { status: 'alive', uptime: 3600 }` |
| `GET /ready` | Readiness probe (Tất cả DB & Queue sẵn sàng) | `200 { status: 'ready', dependencies: {...} }` hoặc `503` |
| `GET /capabilities` | Khả năng công khai (Không lộ lọt hạ tầng mật) | `200 { durableQueue: true, urlToPdf: false, ... }` |
