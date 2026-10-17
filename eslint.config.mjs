import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          // Layering is documented in CLAUDE.md ("Libs and apps").
          depConstraints: [
            { sourceTag: 'type:dto', onlyDependOnLibsWithTags: [] },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:dto', 'type:util'],
            },
            {
              sourceTag: 'type:contracts',
              onlyDependOnLibsWithTags: ['type:dto', 'type:util'],
            },
            {
              sourceTag: 'type:data',
              onlyDependOnLibsWithTags: [
                'type:contracts',
                'type:dto',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:backend',
              onlyDependOnLibsWithTags: [
                'type:contracts',
                'type:dto',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:ui-state-worker',
              onlyDependOnLibsWithTags: [
                'type:contracts',
                'type:dto',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:ui-state',
              onlyDependOnLibsWithTags: [
                'type:ui-state-worker',
                'type:contracts',
                'type:dto',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: [
                'type:ui-state',
                'type:contracts',
                'type:dto',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:shell',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:ui-state',
                'type:contracts',
                'type:dto',
                'type:util',
              ],
            },
            {
              sourceTag: 'type:server',
              onlyDependOnLibsWithTags: [
                'type:backend',
                'type:data',
                'type:contracts',
                'type:dto',
                'type:util',
              ],
            },
            { sourceTag: 'type:e2e', onlyDependOnLibsWithTags: ['*'] },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:node',
              onlyDependOnLibsWithTags: ['scope:node', 'scope:shared'],
            },
            {
              sourceTag: 'scope:worker',
              onlyDependOnLibsWithTags: ['scope:worker', 'scope:shared'],
            },
            {
              sourceTag: 'scope:browser',
              onlyDependOnLibsWithTags: [
                'scope:browser',
                'scope:worker',
                'scope:shared',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
