// Packages the staged dist/app (see scripts/build.mjs) for Linux and Windows x64.
const electronVersion = require('electron/package.json').version;

// better-sqlite3 ships N-API prebuilds for every platform; drop the other platforms'.
const dropPrebuilds = (platforms) =>
  `!node_modules/better-sqlite3/prebuilds/{${platforms}}*.node`;

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'lv.zuzon.zinc',
  productName: 'Zinc Navigation',
  executableName: 'zinc-navigation',
  copyright: 'Copyright © Aigars Zeiza',
  electronVersion,
  directories: {
    app: 'dist/app',
    output: 'dist/release',
    buildResources: 'build',
  },
  files: ['**/*', '!**/*.map'],
  // Native modules can't load from inside the archive, and the DB worker
  // thread that requires better-sqlite3 resolves it next to itself.
  asarUnpack: ['db-worker.cjs', 'node_modules/**'],
  // better-sqlite3 needs no rebuild: its prebuilds are N-API, any Electron ABI.
  npmRebuild: false,
  nodeGypRebuild: false,
  artifactName: '${name}-${version}-${os}-${arch}.${ext}',
  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }],
    category: 'Utility',
    syncDesktopName: true,
    icon: 'build/icon.png',
    files: [dropPrebuilds('darwin,win32,linux-arm64,linuxmusl-arm64')],
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.ico',
    files: [dropPrebuilds('darwin,linux,win32-arm64')],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    artifactName: '${name}-${version}-setup-${arch}.${ext}',
  },
};
