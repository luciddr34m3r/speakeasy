import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, '../web/public/icons/icon.svg');
const outDir = resolve(__dirname, '../web/public/icons');

const svg = readFileSync(svgPath);

await sharp(svg).resize(192, 192).png().toFile(`${outDir}/icon-192.png`);
console.log('✓ icon-192.png');

await sharp(svg).resize(512, 512).png().toFile(`${outDir}/icon-512.png`);
console.log('✓ icon-512.png');

await sharp(svg).resize(72, 72).greyscale().png().toFile(`${outDir}/badge-72.png`);
console.log('✓ badge-72.png');

console.log('Done!');
