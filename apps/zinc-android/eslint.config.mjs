import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Gradle project: generated and copied assets, native sources.
    ignores: ['android/**'],
  },
];
