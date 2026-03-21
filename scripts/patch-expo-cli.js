const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'utils',
  'port.js'
);

function applyPatch(contents) {
  const needle = `        const port = await (0, _freeportasync().default)(defaultPort, {\n            hostnames: [\n                host ?? null\n            ]\n        });`;

  const replacement = `        const normalizedHost = host === 'lan' || host === 'tunnel' ? null : host;\n        const port = await (0, _freeportasync().default)(defaultPort, {\n            hostnames: [\n                normalizedHost ?? null\n            ]\n        });`;

  if (contents.includes(replacement)) {
    return { changed: false, contents };
  }

  if (!contents.includes(needle)) {
    throw new Error('Expected Expo CLI port block was not found. Patch may need an update.');
  }

  return {
    changed: true,
    contents: contents.replace(needle, replacement),
  };
}

function main() {
  if (!fs.existsSync(targetFile)) {
    console.warn(`[patch-expo-cli] Skipped: ${targetFile} not found.`);
    return;
  }

  const current = fs.readFileSync(targetFile, 'utf8');
  const result = applyPatch(current);

  if (result.changed) {
    fs.writeFileSync(targetFile, result.contents, 'utf8');
    console.log('[patch-expo-cli] Applied Expo CLI LAN/TUNNEL port fix.');
  } else {
    console.log('[patch-expo-cli] Expo CLI patch already applied.');
  }
}

main();
