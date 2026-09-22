# 🚀 Hệ Thống CI/CD Chuẩn Doanh Nghiệp (FileTools App)

Tài liệu hướng dẫn chi tiết quy trình CI/CD tự động bằng GitHub Actions, kiểm soát chặt chẽ quy trình triển khai lên **Vercel** (Frontend) và **Render** (Backend).

---

## 1. Kiến Trúc Pipeline

```mermaid
flowchart TD
    Dev[Developer: git push / PR] --> Runner[GitHub Actions Runner]

    subgraph CI["1. Quality Gate (ci.yml) - Chạy Song Song"]
        Runner --> Sec[Luồng 1: Security & Secret Leak Scan]
        Runner --> Back[Luồng 2: Backend Test Node 20 & 22]
        Runner --> Front[Luồng 3: Frontend Vite Build & PWA]
        Runner --> Dock[Luồng 4: Dockerfile Build Test]
    end

    CI -->|TẤT CẢ PHẢI PASS TRÊN 'main'| Decision{CI Thành Công?}
    Decision -->|Có: success| CD["2. Continuous Delivery (deploy.yml)"]
    Decision -->|Không: failure| Blocked[🚫 CHẶN TOÀN BỘ DEPLOY - Render & Vercel GIỮ NGUYÊN]

    subgraph CD["2. Triển Khai Sản Phẩm"]
        CD --> Render[Trigger Render Deploy Hook - Backend]
        CD --> Vercel[Deploy Vercel Production - Frontend]
    end
```

---

## 2. Hướng Dẫn Chặn Render Deploy Trước Khi CI Xong

Mặc định khi kết nối Render với GitHub, mỗi khi bạn `git push`, Render sẽ tự động kéo code về build ngay lập tức mà không cần biết CI có pass hay không.

Để chặn Render deploy sớm và **chỉ cho phép deploy sau khi GitHub CI hoàn tất thành công**, bạn thực hiện 3 bước chuẩn sau:

### Bước 1: Tắt "Auto-Deploy" trên Render Dashboard
1. Truy cập **[Render Dashboard](https://dashboard.render.com/)**.
2. Chọn Web Service / Docker Service backend của bạn (`filetools-backend`).
3. Vào tab **Settings** $\rightarrow$ Kéo xuống mục **Build & Deploy**.
4. Tìm dòng **Auto-Deploy**: Nhấn **Edit** và chuyển từ **"Yes"** sang **"No"**.
5. Nhấn **Save Changes**.
*(Sau bước này, mỗi lần bạn `git push`, Render sẽ đứng im, không bao giờ tự động build nữa).*

### Bước 2: Tạo "Deploy Hook" trên Render
1. Vẫn tại mục **Build & Deploy** trong tab **Settings** của Render.
2. Tìm dòng **Deploy Hook** và nhấn **Add Deploy Hook** (hoặc copy URL nếu đã có).
3. Đặt tên (ví dụ: `GitHub Actions CI/CD Hook`).
4. Copy đường dẫn webhook URL có định dạng:
   ```text
   https://api.render.com/deploy/srv-xxxxxxxxxxxxxxxx?key=yyyyyyyyyyyy
   ```

### Bước 3: Lưu Hook URL vào GitHub Secrets
1. Mở repository GitHub của bạn.
2. Vào **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
3. Nhấn **New repository secret**:
   - **Name**: `RENDER_DEPLOY_HOOK_URL`
   - **Secret**: Dán toàn bộ URL lấy từ Bước 2 vào.
4. Nhấn **Add secret**.

> [!NOTE]
> File [`render.yaml`](file:///C:/Users/Admin/test_app/filetools-app/render.yaml) đã được cấu hình sẵn thuộc tính `autoDeploy: false` cho những ai sử dụng Render Blueprint.

---

## 3. Hướng Dẫn Chặn Vercel Deploy Trước Khi CI Xong

### Cấu hình "Ignored Build Step" trên Vercel:
1. Vào **Vercel Dashboard** $\rightarrow$ Chọn dự án $\rightarrow$ **Settings** $\rightarrow$ **Git**.
2. Tìm mục **Ignored Build Step** và chọn **Command**.
3. Nhập lệnh sau:
   ```bash
   exit 0
   ```
4. Nhấn **Save**.
*(Lệnh này khiến Vercel webhook bỏ qua mọi lần push thông thường. Việc deploy sẽ do file `deploy.yml` đảm nhiệm khi CI pass).*

### Cấu hình GitHub Secrets cho Vercel:
Thêm 3 Secrets vào GitHub Repo (**Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**):
- `VERCEL_TOKEN`: Token lấy từ tài khoản cá nhân Vercel (Account Settings $\rightarrow$ Tokens).
- `VERCEL_ORG_ID`: Lấy trong Settings dự án hoặc file `.vercel/project.json`.
- `VERCEL_PROJECT_ID`: Lấy trong Settings dự án hoặc file `.vercel/project.json`.

---

## 4. Danh Sách Các Workflows Trong Hệ Thống

| Workflow | File | Nhiệm Vụ | Điều Kiện Kích Hoạt |
| :--- | :--- | :--- | :--- |
| **CI - Quality & Build Assurance** | [`.github/workflows/ci.yml`](file:///C:/Users/Admin/test_app/filetools-app/.github/workflows/ci.yml) | Chạy 4 luồng song song: Gitleaks, Node 20 & 22 syntax test, Vite client build, Dockerfile test | Mọi `push` và `pull_request` vào `main`, `master`, `develop` |
| **CD - Deploy to Production** | [`.github/workflows/deploy.yml`](file:///C:/Users/Admin/test_app/filetools-app/.github/workflows/deploy.yml) | Kích hoạt Render Deploy Hook và build Vercel | **CHỈ KHI** `ci.yml` hoàn tất với kết quả **SUCCESS** trên `main` |
| **Dependabot** | [`.github/dependabot.yml`](file:///C:/Users/Admin/test_app/filetools-app/.github/dependabot.yml) | Quét lỗ hổng và đề xuất cập nhật dependencies định kỳ | Tự động hàng tuần |
