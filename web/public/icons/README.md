# App Icons

Place PNG icons here before deploying:
- `icon-192.png` — 192×192px (PWA install + push notification)
- `icon-512.png` — 512×512px (splash screen)
- `badge-72.png` — 72×72px monochrome (Android notification badge)

A source SVG is at `icon.svg`. Convert with:
  magick icon.svg -resize 192x192 icon-192.png
  magick icon.svg -resize 512x512 icon-512.png
  magick icon.svg -resize 72x72 -colorspace gray badge-72.png

Or use https://realfavicongenerator.net/ with the SVG.
