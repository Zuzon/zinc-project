// Runs the Capacitor CLI with the Android SDK located the way Gradle finds it:
// ANDROID_HOME, then sdk.dir in android/local.properties, then ~/Android/Sdk.
// `run` without --target picks a connected device, else boots an emulator:
// ZINC_AVD or the first AVD (native-run starts it).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const projectDir = join(import.meta.dirname, '..');
const localProperties = join(projectDir, 'android/local.properties');

function sdkFromLocalProperties() {
  if (!existsSync(localProperties)) {
    return undefined;
  }
  const match = /^sdk\.dir=(.*)$/m.exec(readFileSync(localProperties, 'utf8'));
  return match?.[1].trim().replace(/\\(.)/g, '$1');
}

const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  sdkFromLocalProperties() ||
  join(homedir(), 'Android/Sdk');
if (!existsSync(sdk)) {
  console.error(
    `[cap] Android SDK not found at ${sdk}; set ANDROID_HOME (see CLAUDE.md, zinc-android toolchain).`,
  );
  process.exit(1);
}
if (!existsSync(localProperties)) {
  // Gradle reads the SDK location from here.
  writeFileSync(localProperties, `sdk.dir=${sdk}\n`);
}
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };

function lines(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8', env })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function pickTarget() {
  const device = lines(join(sdk, 'platform-tools/adb'), ['devices'])
    .map((line) => line.split(/\s+/))
    .find(([, state]) => state === 'device')?.[0];
  if (device) {
    return device;
  }
  const avds = lines(join(sdk, 'emulator/emulator'), ['-list-avds']).filter(
    (line) => !line.startsWith('INFO'),
  );
  const avd = process.env.ZINC_AVD ?? avds[0];
  if (avd) {
    console.info(`[cap] no device connected; booting emulator ${avd}`);
  }
  return avd;
}

const args = process.argv.slice(2);
if (args[0] === 'run' && !args.some((arg) => arg.startsWith('--target'))) {
  const target = pickTarget();
  if (target) {
    args.push('--target', target);
  }
}

try {
  execFileSync('npx', ['cap', ...args], {
    cwd: projectDir,
    env,
    stdio: 'inherit',
  });
} catch (err) {
  process.exit(typeof err.status === 'number' ? err.status : 1);
}
