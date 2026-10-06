import baseConfig from '../../eslint.config.mjs';

export default [
  {
    // Build output, Prisma-generated artefacts, Composer/Alchemy state and the
    // vendored agent skill packs are not hand-written source.
    ignores: [
      '.agents/**',
      '.alchemy/**',
      '.claude/**',
      '.cursor/**',
      '.devin/**',
      '.prisma-composer/**',
      'dist/**',
      'migrations/**',
      'src/prisma/generated/**',
    ],
  },
  ...baseConfig,
];
