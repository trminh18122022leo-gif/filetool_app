FROM node:20-bookworm-slim

# Tránh prompts tương tác khi cài apt
ENV DEBIAN_FRONTEND=noninteractive

# Cài các công cụ hệ thống (chỉ dùng các package TỒN TẠI trong Debian bookworm)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # PDF tools
    ghostscript \
    qpdf \
    # Office conversion
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    # OCR
    tesseract-ocr \
    tesseract-ocr-vie \
    tesseract-ocr-eng \
    # PDF to HTML
    poppler-utils \
    # Chromium for Puppeteer (chữ viết tay)
    chromium \
    chromium-driver \
    # Fonts cơ bản (fonts chữ viết tay load từ Google Fonts CDN qua HTML)
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    # Utilities
    ca-certificates \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Biến môi trường cho Puppeteer: dùng chromium hệ thống, không download riêng
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_BIN=/usr/bin/chromium

WORKDIR /app

# Cài backend dependencies trước (cache layer)
COPY package*.json ./
RUN npm install --production

# Cài client dependencies và build
COPY client/package*.json ./client/
RUN cd client && npm install

# Copy toàn bộ source code
COPY . .

# Build React frontend
RUN cd client && npm run build

# Tạo các thư mục runtime cần thiết
RUN mkdir -p uploads outputs logs

EXPOSE 3001
CMD ["node", "server/index.js"]
