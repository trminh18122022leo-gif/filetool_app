# Mô Hình Đe Dọa & Bảo Mật Khóa Tự Quản (BYOK Threat Model & Key Vault)

**Tài liệu:** BYOK_THREAT_MODEL.md  
**Phiên bản:** 1.0.0  
**Vai trò:** Privacy Engineer & Application Security Architect  
**Trạng thái:** Active Security Invariant  

---

## 1. Tổng Quan & Phạm Vi (Scope)

Tính năng **Bring Your Own Key (BYOK)** cho phép người dùng nhập khóa API cá nhân (Google AI Studio, OpenAI, Groq, Anthropic, Cerebras, OpenRouter) để hưởng hạn mức riêng, sử dụng mô hình độc quyền và tránh phụ thuộc vào hạn mức công cộng của hệ thống.

Vì khóa API có quyền đại diện cho tài khoản và hạn mức tài chính của người dùng tại các nhà cung cấp, rò rỉ khóa là sự cố an ninh nghiêm trọng bậc P0. Tài liệu này xác lập mô hình đe dọa và các cơ chế phòng thủ chuyên sâu.

---

## 2. Mô Hình Đe Dọa (STRIDE Threat Analysis)

| Mối Đe Dọa (STRIDE) | Vector Tấn Công Khả Dĩ | Hậu Quả Tiềm Tàng | Biện Pháp Phòng Thủ Triệt Để |
|---|---|---|---|
| **Spoofing (Giả mạo)** | Kẻ tấn công giả danh người dùng để lấy hoặc sử dụng khóa API. | Tiêu tốn hạn mức hoặc lộ dữ liệu người dùng. | Xác thực JWT HttpOnly Cookie + CSRF protection + phân quyền tenant nghiêm ngặt (`user: req.user._id`). |
| **Tampering (Xáo trộn)** | Thay đổi dữ liệu khóa đã mã hóa trong cơ sở dữ liệu. | Làm hỏng khóa hoặc giải mã sai dữ liệu. | Mã hóa xác thực **AES-256-GCM** kèm **Authentication Tag (16 bytes)**; mọi sửa đổi trái phép sẽ gây lỗi giải mã và chặn tức thì. |
| **Repudiation (Chối bỏ)** | Người dùng phủ nhận việc cấu hình hoặc tiêu thụ hạn mức AI. | Tranh chấp thanh toán hoặc báo cáo vi phạm. | Ghi nhật ký kiểm toán không thể xóa (`AuditLog`) ghi nhận thời gian tạo, cập nhật, kiểm thử kết nối và xoay khóa. |
| **Information Disclosure (Lộ thông tin)** | Lộ khóa qua DB Dump, Logs, Network Traces, URL params hoặc UI. | Kẻ xấu sử dụng khóa người dùng tự do. | Mã hóa lúc nghỉ (At-Rest) bằng khóa nằm ngoài DB (`AI_KEY_ENCRYPTION_SECRET`); không bao giờ trả về khóa thô qua API; che mặt nạ (Masked UI); cấm tuyệt đối in ra log. |
| **Denial of Service (Từ chối dịch vụ)** | Nhập khóa giả mạo khiến hệ thống thử nghiệm lặp lại gây nghẽn. | Chiếm dụng CPU máy chủ. | Rate limit nghiêm ngặt cho endpoint kiểm tra khóa (Tối đa 5 lần/phút); timeout kết nối 5 giây; Circuit Breaker. |
| **Elevation of Privilege (Leo thang đặc quyền)** | Người dùng A truy cập hoặc dùng khóa của Người dùng B. | Vi phạm ranh giới cách ly người thuê. | Kiểm tra quyền sở hữu tuyệt đối tại lớp truy vấn DB (`UserByokKey.findOne({ _id, user: req.user._id })`). |

---

## 3. Kiến Trúc Mã Hóa Phong Bì (Envelope Encryption Specification)

Mỗi khóa API được mã hóa bằng chuẩn công nghiệp **AES-256-GCM** trước khi chạm vào lớp cơ sở dữ liệu MongoDB:

```
[Plaintext API Key] 
         │
         ▼
[AES-256-GCM Encryption Engine] ◄── [Master Key: derived from AI_KEY_ENCRYPTION_SECRET]
         │
         ├──────────────────────────────┬──────────────────────────────┐
         ▼                              ▼                              ▼
 [12-byte Random IV]          [Ciphertext Hex]             [16-byte Auth Tag]
```

### Chi tiết kỹ thuật:
1. **Khóa Chủ (Master Encryption Key):**
   - Được lấy từ biến môi trường máy chủ `AI_KEY_ENCRYPTION_SECRET`.
   - Chuẩn hóa thành 32 bytes (256-bit) thông qua hàm băm mật mã học `crypto.createHash('sha256')`.
   - **Tuyệt đối không lưu Master Key trong cơ sở dữ liệu.**
2. **Véc-tơ Khởi Tạo (Initialization Vector - IV):**
   - Sinh ngẫu nhiên bảo mật 12 bytes (`crypto.randomBytes(12)`) cho **mỗi lần mã hóa**.
   - Không bao giờ tái sử dụng cùng một IV cho hai lần mã hóa khác nhau.
3. **Thẻ Xác Thực (Authentication Tag):**
   - Thu được 16 bytes GCM auth tag để xác thực tính toàn vẹn (Integrity) và xuất xứ dữ liệu (Authenticity).

---

## 4. Chính Sách "Không Trả Về Khóa Thô" (Zero Raw Key Exposure Policy)

1. **Sau khi người dùng gửi khóa lên:**
   - Hệ thống mã hóa khóa ngay trong bộ nhớ tiến trình (RAM).
   - Tạo chuỗi hiển thị che giấu (Masked Key):
     - Ví dụ: `AIzaSy...4X9a` (Giữ 6 ký tự đầu, 4 ký tự cuối, chèn `...` vào giữa).
     - Đối với khóa OpenAI: `sk-proj-...8Ab1`.
   - Lưu chuỗi che giấu vào trường `keyMasked`.
2. **Khi trả lời API (`GET /api/ai/byok`):**
   - Chỉ trả về `provider`, `keyMasked`, `isValid`, `lastValidatedAt`.
   - Trường chứa ciphertext thô (`encryptedKey`, `iv`, `authTag`) có cờ `select: false` trong Mongoose schema, ngăn chặn rò rỉ ngẫu nhiên qua các câu lệnh `find()`.
3. **Trong quá trình thực thi AI:**
   - Khóa chỉ được giải mã tạm thời trong RAM của hàm gọi API nhà cung cấp và giải phóng sau khi hàm kết thúc.
   - Tuyệt đối không log khóa vào `console.log`, Sentry, Winston, Docker logs hay URL query parameters.

---

## 5. Chính Sách Thất Bại Đóng (Fail-Closed Policy)

Nếu môi trường sản xuất chưa cấu hình hoặc cấu hình sai biến `AI_KEY_ENCRYPTION_SECRET` (dưới 32 ký tự ngẫu nhiên):
- Tính năng lưu trữ khóa BYOK bị **vô hiệu hóa tức thì** (Fail-Closed).
- API trả về mã lỗi rõ ràng: `BYOK_KEYVAULT_UNCONFIGURED`.
- Giao diện người dùng hiển thị thông báo trung thực: *"Tính năng BYOK đang tạm tắt vì hệ thống mã hóa phần cứng chưa được quản trị viên cấu hình an toàn."*
- Tuyệt đối không lưu khóa dưới dạng văn bản rõ (plaintext) trong bất kỳ trường hợp nào.
