FROM node:22-bookworm-slim

# Tránh prompts tương tác khi cài apt
ENV DEBIAN_FRONTEND=noninteractive

# Cài đặt và ghim các công cụ hệ thống (Document & Media Processing Manifest)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # PDF engines & utilities
    ghostscript \
    qpdf \
    poppler-utils \
    # Office conversion
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    # OCR (Optical Character Recognition)
    tesseract-ocr \
    tesseract-ocr-vie \
    tesseract-ocr-eng \
    # Media & Audio/Video engines
    ffmpeg \
    # Sandboxed Chromium for Puppeteer
    chromium \
    chromium-driver \
    # Full typography & multilingual font coverage (Vietnamese, Latin, CJK)
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    fonts-dejavu-core \
    # Network & CA certificates
    ca-certificates \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Biến môi trường bảo mật cho Puppeteer & Renderers
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_BIN=/usr/bin/chromium \
    ENABLE_URL_TO_PDF=false \
    NODE_ENV=production

WORKDIR /app

# Tạo user không đặc quyền để chạy Chromium sandbox an toàn (Chống bypass sandbox root)
RUN groupadd -g 1001 filetools && \
    useradd -m -u 1001 -g filetools -s /bin/bash filetools

# Cài backend dependencies trước (cache layer)
COPY package*.json ./
RUN npm install --omit=dev

# Cài client dependencies và build
COPY client/package*.json ./client/
RUN cd client && npm install --include=dev

# Copy toàn bộ source code
COPY . .

# Build React frontend
RUN cd client && npm run build && npm prune --omit=dev

# Tạo các thư mục runtime cần thiết và phân quyền sở hữu cho non-root user
RUN mkdir -p uploads outputs logs && \
    chown -R filetools:filetools /app uploads outputs logs

# Chuyển sang user không đặc quyền
USER filetools

EXPOSE 3001
CMD ["node", "server/index.js"]
