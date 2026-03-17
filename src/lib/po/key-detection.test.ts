import { describe, it, expect } from 'vitest';
import { hasKeyBasedMsgids } from './key-detection';
import type { POEntry } from './types';

function entry(msgid: string): POEntry {
  return {
    id: msgid,
    msgid,
    msgstr: '',
    translatorComments: [],
    extractedComments: [],
    references: [],
    flags: [],
  };
}

describe('hasKeyBasedMsgids', () => {
  it('returns true for dot-separated keys', () => {
    expect(
      hasKeyBasedMsgids([
        entry('button.save'),
        entry('button.cancel'),
        entry('nav.home'),
        entry('settings.language.label'),
      ]),
    ).toBe(true);
  });

  it('returns true for underscore-separated keys', () => {
    expect(
      hasKeyBasedMsgids([entry('BUTTON_SAVE'), entry('NAV_HOME'), entry('SETTINGS_LABEL')]),
    ).toBe(true);
  });

  it('returns true for slash-separated keys', () => {
    expect(
      hasKeyBasedMsgids([
        entry('components/header/title'),
        entry('pages/home/welcome'),
        entry('shared/buttons/submit'),
      ]),
    ).toBe(true);
  });

  it('returns false for natural language strings', () => {
    expect(
      hasKeyBasedMsgids([
        entry('Save changes'),
        entry('Cancel'),
        entry('Go back to home'),
        entry('Are you sure you want to delete this item?'),
      ]),
    ).toBe(false);
  });

  it('returns false for empty entries', () => {
    expect(hasKeyBasedMsgids([])).toBe(false);
  });

  it('returns false when mix is mostly natural text', () => {
    expect(
      hasKeyBasedMsgids([
        entry('Save changes'),
        entry('Cancel the operation'),
        entry('nav.home'), // one key in a sea of natural text
        entry('Please enter your name'),
        entry('Welcome to the app'),
      ]),
    ).toBe(false);
  });

  it('returns true when mix is mostly keys', () => {
    expect(
      hasKeyBasedMsgids([
        entry('button.save'),
        entry('button.cancel'),
        entry('nav.home'),
        entry('Welcome'), // single word without separator
        entry('settings.title'),
      ]),
    ).toBe(true);
  });
});
