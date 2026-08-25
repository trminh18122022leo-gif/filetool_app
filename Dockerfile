FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y \
    ghostscript \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    tesseract-ocr \
    tesseract-ocr-vie \
    tesseract-ocr-eng \
    qpdf \
    poppler-utils \
    chromium \
    fonts-liberation \
    fonts-caveat \
    fonts-dancing-script \
    fonts-patrick-hand \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN cd client && npm install && npm run build

EXPOSE 3001
CMD ["node", "server/index.js"]
