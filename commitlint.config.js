const historicalCommitlintIgnores = [
  'Initial plan',
  'Update src/test/setup.ts',
  'fix: Dutch translation for API key validation message',
];

export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (message) =>
      historicalCommitlintIgnores.some((ignoredHeader) => message.startsWith(ignoredHeader)),
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
