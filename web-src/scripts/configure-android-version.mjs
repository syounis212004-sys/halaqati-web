import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
const versionName = String(pkg.version || '1.0.0');
const parts = versionName.split('.').map(x => Number.parseInt(x, 10) || 0);
const [major=0, minor=0, patch=0] = parts;
const versionCode = major * 10000 + minor * 100 + patch;

const candidates = [
  path.join(cwd, 'android', 'app', 'build.gradle'),
  path.join(cwd, 'android', 'app', 'build.gradle.kts'),
];

const gradlePath = candidates.find(p => fs.existsSync(p));
if (!gradlePath) {
  console.error('Android app Gradle file not found.');
  console.error(candidates.join('\n'));
  process.exit(1);
}

let src = fs.readFileSync(gradlePath, 'utf8');

const isKts = gradlePath.endsWith('.kts');
if (isKts) {
  if (/versionCode\s*=\s*\d+/.test(src)) {
    src = src.replace(/versionCode\s*=\s*\d+/, `versionCode = ${versionCode}`);
  } else {
    throw new Error('versionCode was not found in build.gradle.kts');
  }
  if (/versionName\s*=\s*"[^"]*"/.test(src)) {
    src = src.replace(/versionName\s*=\s*"[^"]*"/, `versionName = "${versionName}"`);
  } else {
    throw new Error('versionName was not found in build.gradle.kts');
  }
} else {
  if (/versionCode\s+\d+/.test(src)) {
    src = src.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  } else if (/versionCode\s*=\s*\d+/.test(src)) {
    src = src.replace(/versionCode\s*=\s*\d+/, `versionCode = ${versionCode}`);
  } else {
    throw new Error('versionCode was not found in build.gradle');
  }

  if (/versionName\s+"[^"]*"/.test(src)) {
    src = src.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
  } else if (/versionName\s*=\s*"[^"]*"/.test(src)) {
    src = src.replace(/versionName\s*=\s*"[^"]*"/, `versionName = "${versionName}"`);
  } else {
    throw new Error('versionName was not found in build.gradle');
  }
}

fs.writeFileSync(gradlePath, src);
console.log(`Android version configured: ${versionName} (${versionCode})`);
console.log(`Updated: ${gradlePath}`);
