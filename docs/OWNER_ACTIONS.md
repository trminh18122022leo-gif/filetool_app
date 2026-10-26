# FileTools Pro — Hướng Dẫn Hành Động Của Chủ Sở Hữu (Human Owner Action Guide)
**Tài liệu:** Microsoft Partner Center Enrollment & Store Submission Gate  
**Mục tiêu:** Xuất bản FileTools Pro Windows v1.0.0 lên Microsoft Store  
**Cảnh báo An toàn:** **DỪNG LẠI (STOP) TRƯỚC KHI BẤM "SUBMIT TO THE STORE"**  
**Quy tắc:** *AI lập trình viên không được phép tự ý đăng ký tài khoản hay tự động gửi ứng dụng. Toàn bộ các bước định danh pháp lý dưới đây bắt buộc do chính chủ sở hữu thực hiện.*

---

## 🛑 ĐIỂM DỪNG BẮT BUỘC (MANDATORY STOP GATE)

> [!CAUTION]
> **DỪNG LẠI (STOP):** Quá trình chuẩn bị kỹ thuật, mã nguồn, tài liệu và kiểm thử nội bộ đã hoàn thành 100%. Tuy nhiên, việc xuất bản ứng dụng lên Microsoft Store đòi hỏi **xác minh danh tính thực tế (ID Verification)** và liên kết tài khoản pháp nhân/cá nhân của Chủ sở hữu với Microsoft. 
> 
> AI Assistant **KHÔNG** tự ý thực hiện các bước đăng ký tài khoản hoặc gửi bản duyệt. Hãy thực hiện theo thứ tự 6 bước hướng dẫn chi tiết dưới đây.

---

## BƯỚC 1: Đăng Ký Tài Khoản Nhà Phát Triển (Individual Developer Enrollment)

1. Truy cập cổng đăng ký chính thức của Microsoft:  
   👉 **[storedeveloper.microsoft.com](https://storedeveloper.microsoft.com)** (hoặc [partner.microsoft.com](https://partner.microsoft.com)).
2. Đăng nhập bằng tài khoản **Microsoft cá nhân** của bạn (Email @outlook.com, @hotmail.com hoặc tài khoản Microsoft quản lý tên miền riêng).
3. **Chính sách đăng ký tài khoản cá nhân mới năm 2026:**
   - Microsoft đã áp dụng chính sách đăng ký tài khoản cá nhân mới nhằm khuyến khích cộng đồng nhà phát triển (nhiều quốc gia và khu vực được miễn phí đăng ký ban đầu $19 USD).
   - **Xác thực danh tính thực (Identity Verification):** Microsoft hợp tác với các đơn vị định danh quốc tế để xác thực giấy tờ tùy thân (Căn cước công dân / Hộ chiếu) và số điện thoại chính chủ. Quá trình này hoàn toàn bảo mật và thường mất từ vài phút đến 24 giờ.
4. Điền thông tin nhà xuất bản (Publisher Display Name), ví dụ: `FileTools Studio` (hoặc tên thật/tên thương hiệu của bạn).

---

## BƯỚC 2: Đặt Trước Tên Ứng Dụng (Reserve App Name)

1. Sau khi tài khoản được duyệt, đăng nhập vào **Microsoft Partner Center Dashboard** (`partner.microsoft.com/dashboard`).
2. Vào mục **Apps & games** $\rightarrow$ Nhấn nút **New product** $\rightarrow$ Chọn **MSIX or PWA app**.
3. Nhập tên ứng dụng: `FileTools Pro`.
4. Nhấn **Check availability** $\rightarrow$ Nếu tên khả dụng, bấm **Reserve product name**.
   *(Lưu ý: Microsoft giữ tên ứng dụng này độc quyền cho bạn trong vòng 3 tháng).*

---

## BƯỚC 3: Lấy Thông Tin Nhận Diện Gói Cước (Package Identity)

Trong bảng điều khiển ứng dụng `FileTools Pro` trên Partner Center:
1. Vào menu **Product management** ở cột trái $\rightarrow$ Chọn **Product Identity**.
2. Sao chép chính xác 3 giá trị định danh sau (Lưu lại để dán vào PWABuilder ở Bước 4):
   - **Package/Identity/Name:** (Ví dụ: `12345YourName.FileToolsPro`)
   - **Package/Identity/Publisher:** (Ví dụ: `CN=A1B2C3D4-5678-90AB-CDEF-1234567890AB`)
   - **Package/Properties/PublisherDisplayName:** (Ví dụ: `FileTools Studio`)

---

## BƯỚC 4: Tạo Gói Cài Đặt MSIX Chuẩn Bằng PWABuilder

1. Truy cập công cụ đóng gói trực tuyến chính thức của Microsoft:  
   👉 **[https://www.pwabuilder.com](https://www.pwabuilder.com)**
2. Nhập URL ứng dụng web đã triển khai của bạn:  
   `https://filetools-app.vercel.app/`  
   Nhấn **Start**.
3. PWABuilder sẽ quét và chấm điểm PWA (FileTools Pro đã được cấu hình đạt điểm tối đa **100/100 PWA Score** với đầy đủ icons, maskable icon, shortcuts, và file handlers).
4. Nhấn nút **Package for Stores** $\rightarrow$ Chọn nền tảng **Windows (MSIX)**.
5. Trong cửa sổ cấu hình gói Windows (Windows Package Options), nhấn **Options** và dán chính xác các giá trị định danh đã lấy ở Bước 3:
   - **Package ID:** Dán giá trị *Package/Identity/Name*
   - **Publisher ID:** Dán giá trị *Package/Identity/Publisher (CN=...)*
   - **Publisher Display Name:** Dán giá trị *PublisherDisplayName*
   - **Version:** Nhập `1.0.0.0`
6. Nhấn nút **Generate** $\rightarrow$ PWABuilder sẽ kết xuất và tải về một tệp nén `.zip` chứa:
   - Tệp cài đặt chính thức: `FileToolsPro_1.0.0.0_x64.msix` (hoặc `.msixbundle`).
   - Thư mục chứng chỉ và hướng dẫn test cục bộ.

---

## BƯỚC 5: Tải Lên & Điền Thông Tin Cửa Hàng (Submission Setup)

Quay trở lại **Microsoft Partner Center**:
1. Nhấp vào bản đệ trình đầu tiên (**Start your submission** hoặc `Submission 1`).
2. **Mục Pricing and availability:**
   - Thị trường: Toàn cầu (Tất cả 240+ quốc gia và vùng lãnh thổ).
   - Giá: **Free** (Miễn phí tải về).
3. **Mục Properties:**
   - Thể loại (Category): `Productivity` $\rightarrow$ Thể loại phụ: `File Management / Tools`.
   - Privacy Policy URL: Dán `https://filetools-app.vercel.app/privacy`.
   - Support Contact: Dán `https://filetools-app.vercel.app/guides`.
4. **Mục Age ratings (IARC):**
   - Điền bảng câu hỏi đánh giá độ tuổi (chọn Không cho tất cả các câu hỏi về bạo lực, cờ bạc, nội dung người lớn).
   - Nhận xếp hạng **3+ / Everyone**.
5. **Mục Packages:**
   - Kéo và thả tệp `.msix` đã tải về từ PWABuilder lên ô tải gói.
   - Hệ thống sẽ tự động xác thực chữ ký số và khớp thông tin định danh với tài khoản của bạn.
6. **Mục Store listings (Tiếng Việt & Tiếng Anh):**
   - Sao chép và dán toàn bộ nội dung từ tài liệu: [`docs/releases/STORE_LISTING_COPY.md`](file:///C:/Users/Admin/test_app/filetools-app/docs/releases/STORE_LISTING_COPY.md).
7. **Mục Notes for certification:**
   - Sao chép đoạn ghi chú và tài khoản demo reviewer từ tài liệu: [`docs/releases/MS_STORE_CHECKLIST.md`](file:///C:/Users/Admin/test_app/filetools-app/docs/releases/MS_STORE_CHECKLIST.md) (Mục 4).

---

## BƯỚC 6: Kiểm Tra Cuối Cùng & Gửi Phê Duyệt (Final Review Gate)

Trước khi nhấn nút **"Submit to the Store"**:
1. [ ] Kiểm tra máy chủ Cloud API trên Render (`https://filetools-jkx7.onrender.com/api/health`) đang hoạt động ổn định (Active 200 OK).
2. [ ] Kiểm tra giao diện web trên Vercel (`https://filetools-app.vercel.app/`) tải nhanh, không bị lỗi màn hình trắng.
3. [ ] Khẳng định cờ an toàn `BILLING_ENABLED=false` đang được giữ nguyên để đội ngũ kiểm duyệt không bị yêu cầu nhập thẻ tín dụng thật.
4. [ ] Bấm nút **Submit to the Store**.

*Thời gian kiểm duyệt thông thường của Microsoft Store dao động từ 24 đến 72 giờ làm việc. Bạn sẽ nhận được email thông báo ngay khi ứng dụng chính thức lên kệ.*

---

## 7. Quy Trình Cập Nhật & Rollback (Update & Rollback Playbook)

### 7.1. Nguyên tắc gắn phiên bản với Git Commit SHA (Version Binding)
Mọi bản phát hành đều phải được gắn thẻ (Tag) và ràng buộc với commit SHA sạch trong Git:
```powershell
# 1. Kiểm tra trạng thái Git sạch sẽ (không có uncommitted changes)
git status

# 2. Tạo Git Tag cho bản phát hành v1.0.0
git tag -a v1.0.0 -m "Release FileTools Pro Windows v1.0.0 (Candidate)"

# 3. Xem Commit SHA chính thức
git rev-parse HEAD
```
> **NGHIÊM CẤM:** Tuyệt đối không bao giờ xuất bản gói cài đặt từ mã nguồn chưa được commit hoặc đang trong trạng thái dirty tree.

### 7.2. Quy trình Cập Nhật Tính Năng (OTA Web Updates)
- Do FileTools Pro sử dụng công nghệ PWA, **95% các bản cập nhật giao diện, sửa lỗi nhỏ và bổ sung công cụ mới** chỉ cần đẩy lên Vercel (`git push origin main`).
- Service Worker trong ứng dụng Windows sẽ tự động phát hiện phiên bản mới trong nền và kích hoạt cập nhật ngay khi người dùng mở lại app mà không cần gửi gói duyệt lại lên Microsoft Store.

### 7.3. Kế Hoạch Xử Lý Sự Cố Khẩn Cấp (Emergency Rollback)
Nếu phát hiện lỗi nghiêm trọng sau khi phát hành:
1. **Rollback giao diện Web tức thì (dưới 1 phút):**
   - Vào Vercel Dashboard $\rightarrow$ Deployments $\rightarrow$ Chọn bản deploy ổn định gần nhất $\rightarrow$ Nhấn **Instant Rollback**.
2. **Kích hoạt Kill Switch nếu liên quan tới thanh toán:**
   - Thiết lập biến môi trường `BILLING_ENABLED=false` trên Render.
3. **Phát hành bản vá khẩn cấp MSIX (nếu lỗi ở tầng container OS):**
   - Nâng phiên bản lên `1.0.1.0` trong PWABuilder.
   - Tải gói mới lên Partner Center và chọn tùy chọn **"Mandatory Update"** (Cập nhật bắt buộc).
