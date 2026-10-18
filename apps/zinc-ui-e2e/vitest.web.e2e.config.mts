import { defineConfig } from 'vitest/config';
import { e2eConfig } from './vitest.shared.mjs';

export default defineConfig(() => e2eConfig('web'));
