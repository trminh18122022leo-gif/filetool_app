const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconDir = path.resolve(__dirname, '../client/public/icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F59E0B"/>
      <stop offset="50%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#F97316"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="#08080C"/>
  <rect x="8" y="8" width="496" height="496" rx="92" fill="none" stroke="url(#gold)" stroke-width="8" opacity="0.4"/>
  <path d="M280 40 L160 280 L250 280 L232 472 L352 232 L262 232 Z" fill="url(#gold)"/>
</svg>
`);

async function generate() {
  await sharp(svg).resize(192, 192).png().toFile(path.join(iconDir, 'icon-192.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(iconDir, 'icon-512.png'));
  await sharp(svg).resize(512, 512).png().toFile(path.join(iconDir, 'icon-512-mask.png'));
  console.log('PWA Icons generated in:', iconDir);
}

generate().catch(console.error);
