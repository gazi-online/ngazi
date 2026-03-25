const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcPath = 'C:\\Users\\Gazi Online\\.gemini\\antigravity\\brain\\7ffd2a57-edc2-417e-b09e-0d0bc3762864\\gazi_online_icon_1774371552653.png';
const outDir = 'd:\\PROJRCT\\gazi-online-v2 (1)\\gazi-online\\frontend\\public\\icons';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  for (const size of sizes) {
    const outPath = path.join(outDir, `icon-${size}.png`);
    await sharp(srcPath)
      .resize(size, size)
      .toFile(outPath);
    console.log(`Saved icon-${size}.png`);
  }
  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
