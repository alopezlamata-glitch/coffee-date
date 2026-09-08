const fs = require('fs');
const path = require('path');
const { encodePNG } = require('../lib/png');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BG = [61, 36, 24]; // dark coffee
const RIM = [245, 235, 220]; // cream cup rim
const COFFEE = [111, 78, 55]; // coffee brown
const HIGHLIGHT = [255, 255, 255];

function makeIcon(size) {
  const cx = size / 2;
  const cy = size / 2;
  const rimR = size * 0.36;
  const coffeeR = size * 0.29;
  const handleCx = cx + rimR * 0.95;
  const handleCy = cy;
  const handleOuterR = size * 0.16;
  const handleInnerR = size * 0.09;

  return encodePNG(size, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const hdx = x - handleCx;
    const hdy = y - handleCy;
    const hdist = Math.sqrt(hdx * hdx + hdy * hdy);
    if (hdist <= handleOuterR && hdist >= handleInnerR && x >= cx) {
      return [...RIM, 255];
    }

    if (dist <= rimR) {
      if (dist <= coffeeR) {
        // subtle highlight crescent, upper-left of the coffee
        const hlx = x - (cx - coffeeR * 0.35);
        const hly = y - (cy - coffeeR * 0.35);
        const hlDist = Math.sqrt(hlx * hlx + hly * hly);
        if (hlDist <= coffeeR * 0.32) {
          return [...HIGHLIGHT, 60];
        }
        return [...COFFEE, 255];
      }
      return [...RIM, 255];
    }

    return [...BG, 255];
  });
}

const sizes = [192, 512];
for (const size of sizes) {
  const buf = makeIcon(size);
  fs.writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), buf);
  console.log(`Generado icon-${size}.png`);
}

const appleBuf = makeIcon(180);
fs.writeFileSync(path.join(OUT_DIR, 'apple-touch-icon.png'), appleBuf);
console.log('Generado apple-touch-icon.png');
