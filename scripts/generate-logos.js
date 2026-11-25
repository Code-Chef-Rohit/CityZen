import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const iconsDir = path.join(publicDir, 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('Rendering high-resolution CityZen brand assets...');

// 1. Create a wrapper HTML for 1024x1024 square icon
const iconSvgContent = fs.readFileSync(path.join(publicDir, 'logo-icon.svg'), 'utf8');
const iconHtmlPath = path.join(publicDir, '_temp_icon.html');
const iconHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1024px; height: 1024px; overflow: hidden; background: transparent; }
    svg { width: 1024px; height: 1024px; display: block; }
  </style>
</head>
<body>
  ${iconSvgContent}
</body>
</html>`;
fs.writeFileSync(iconHtmlPath, iconHtml);

// 2. Render 1024x1024 PNG
const rawPngPath = path.join(publicDir, 'logo.png');
const rawJpgPath = path.join(publicDir, 'logo.jpg');
execFileSync(edgePath, [
  '--headless',
  '--disable-gpu',
  '--force-device-scale-factor=1',
  '--window-size=1024,1024',
  `--screenshot=${rawPngPath}`,
  `file:///${iconHtmlPath.replace(/\\/g, '/')}`
]);
console.log('Generated public/logo.png (1024x1024)');

// 3. Render 400x140 email logo banner
const emailSvgContent = fs.readFileSync(path.join(publicDir, 'logo-email.svg'), 'utf8');
const emailHtmlPath = path.join(publicDir, '_temp_email.html');
const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 400px; height: 140px; overflow: hidden; background: #ffffff; }
    svg { width: 400px; height: 140px; display: block; }
  </style>
</head>
<body>
  ${emailSvgContent}
</body>
</html>`;
fs.writeFileSync(emailHtmlPath, emailHtml);

const emailPngPath = path.join(publicDir, 'email-logo.png');
execFileSync(edgePath, [
  '--headless',
  '--disable-gpu',
  '--force-device-scale-factor=1',
  '--window-size=400,140',
  `--screenshot=${emailPngPath}`,
  `file:///${emailHtmlPath.replace(/\\/g, '/')}`
]);
console.log('Generated public/email-logo.png (400x140)');

// Clean up temporary HTML files
if (fs.existsSync(iconHtmlPath)) fs.unlinkSync(iconHtmlPath);
if (fs.existsSync(emailHtmlPath)) fs.unlinkSync(emailHtmlPath);

// 4. Use Python PIL to resize icons and create clean JPEG & PNG sizes
const pyScript = path.join(projectRoot, 'scripts', '_resize.py');
fs.writeFileSync(pyScript, `
from PIL import Image
import os

src_icon = r"${rawPngPath}"
im = Image.open(src_icon)

# Crop/resize to 1024x1024
if im.size != (1024, 1024):
    im = im.resize((1024, 1024), Image.Resampling.LANCZOS)

# Save high-res JPEG
im_rgb = im.convert('RGB')
im_rgb.save(r"${rawJpgPath}", 'JPEG', quality=95)

# Save icons in public/icons
im.resize((512, 512), Image.Resampling.LANCZOS).save(r"${path.join(iconsDir, 'icon-512.png')}")
im.resize((192, 192), Image.Resampling.LANCZOS).save(r"${path.join(iconsDir, 'icon-192.png')}")
im.resize((180, 180), Image.Resampling.LANCZOS).save(r"${path.join(iconsDir, 'apple-touch-icon.png')}")
im.resize((64, 64), Image.Resampling.LANCZOS).save(r"${path.join(iconsDir, 'favicon-64.png')}")
im.resize((32, 32), Image.Resampling.LANCZOS).save(r"${path.join(iconsDir, 'favicon-32.png')}")

# Save email logo
email_path = r"${emailPngPath}"
em = Image.open(email_path)
if em.size != (400, 140):
    em = em.resize((400, 140), Image.Resampling.LANCZOS)
    em.save(email_path)

print("All icon variations generated successfully!")
`);

execSync(`python "${pyScript}"`);
if (fs.existsSync(pyScript)) fs.unlinkSync(pyScript);
console.log('Brand asset generation complete!');

