import { describe, expect, it } from 'vitest';
import { extractMessagesFromSource } from './extract-i18n';

describe('extractMessagesFromSource', () => {
  it('extracts t() with single-quoted string', () => {
    const source = `const x = t('simple');`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('simple')).toEqual(['test.tsx:1']);
  });

  it('extracts t() with double-quoted string', () => {
    const source = `const x = t("double quoted");`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('double quoted')).toEqual(['test.tsx:1']);
  });

  it('handles escaped quotes inside strings', () => {
    const source = `const x = t('escaped \\'quote\\'');`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get("escaped 'quote'")).toEqual(['test.tsx:1']);
  });

  it('extracts first argument and ignores additional arguments', () => {
    const source = `t('msg', { values: { x: 1 } })`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('msg')).toEqual(['test.tsx:1']);
  });

  it('warns on dynamic t(variable) calls', () => {
    const source = `t(variable)`;
    const { messages, warnings } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.size).toBe(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/Dynamic/);
  });

  it('warns on template literal t(`...`)', () => {
    const source = 't(`template`)';
    const { messages, warnings } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.size).toBe(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/Template literal/);
  });

  it('does not produce false positives for non-t functions', () => {
    const source = `
reset('foo');
export('bar');
const count = items.length;
`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.size).toBe(0);
  });

  it('tracks correct line numbers', () => {
    const source = `
const a = 1;
const b = t('line three');
const c = 2;
const d = t('line five');
`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('line three')).toEqual(['test.tsx:3']);
    expect(messages.get('line five')).toEqual(['test.tsx:5']);
  });

  it('extracts multiple t() calls on the same line', () => {
    const source = `label={isDark ? t('Light mode') : t('Dark mode')}`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('Light mode')).toEqual(['test.tsx:1']);
    expect(messages.get('Dark mode')).toEqual(['test.tsx:1']);
  });

  it('deduplicates msgids and collects all references', () => {
    const source = `
t('hello');
t('hello');
`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('hello')).toEqual(['test.tsx:2', 'test.tsx:3']);
  });

  it('handles t() at start of line', () => {
    const source = `t('start of line')`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('start of line')).toEqual(['test.tsx:1']);
  });

  it('handles strings with escaped double quotes', () => {
    const source = `t("say \\"hello\\"")`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('say "hello"')).toEqual(['test.tsx:1']);
  });

  it('handles JSX expression with t()', () => {
    const source = `<Text>{t('Click here')}</Text>`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('Click here')).toEqual(['test.tsx:1']);
  });

  it('decodes \\r escape sequences', () => {
    const source = `t('line\\r\\n')`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('line\r\n')).toEqual(['test.tsx:1']);
  });

  it('decodes \\uXXXX escape sequences', () => {
    const source = `t('ellipsis\\u2026')`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('ellipsis\u2026')).toEqual(['test.tsx:1']);
  });

  it('decodes \\u{XXXX} escape sequences', () => {
    const source = `t('rocket\\u{1F680}')`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('rocket\u{1F680}')).toEqual(['test.tsx:1']);
  });

  it('decodes \\xNN escape sequences', () => {
    const source = `t('nbsp\\xA0here')`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('nbsp\xA0here')).toEqual(['test.tsx:1']);
  });

  it('handles escaped line continuations', () => {
    const source = `t('line\\\ncontinued')`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('linecontinued')).toEqual(['test.tsx:1']);
  });

  it('extracts msgid() calls', () => {
    const source = `const label = msgid('Confirm');`;
    const { messages } = extractMessagesFromSource(source, 'test.tsx');
    expect(messages.get('Confirm')).toEqual(['test.tsx:1']);
  });

  it('includes callee name in dynamic call warnings', () => {
    const source = `msgid(variable)`;
    const { warnings } = extractMessagesFromSource(source, 'test.tsx');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/Dynamic msgid\(\)/);
  });

  it('includes callee name in template literal warnings', () => {
    const source = 'msgid(`template`)';
    const { warnings } = extractMessagesFromSource(source, 'test.tsx');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/Template literal in msgid\(\)/);
  });
});
