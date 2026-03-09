export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (message) =>
      message.startsWith('Initial plan') || message.startsWith('Update src/test/setup.ts'),
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'header-max-length': [2, 'always', 100],
  },
};
