import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, requireJsonRequest, validateRequestOrigin } from './http';

function installDenoEnv(origins: string) {
  vi.stubGlobal('Deno', {
    env: {
      get: vi.fn((key: string) => (key === 'ALLOWED_ORIGINS' ? origins : undefined)),
    },
  });
}

describe('shared HTTP helpers', () => {
  beforeEach(() => {
    installDenoEnv('https://glossboss.test,https://preview.glossboss.test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows configured origins', () => {
    const request = new Request('https://functions.test/feedback', {
      method: 'POST',
      headers: {
        origin: 'https://glossboss.test',
        'content-type': 'application/json',
      },
    });

    expect(validateRequestOrigin(request)).toMatchObject({
      allowed: true,
      origin: 'https://glossboss.test',
    });
  });

  it('rejects unknown origins', () => {
    const request = new Request('https://functions.test/feedback', {
      method: 'POST',
      headers: {
        origin: 'https://example.com',
        'content-type': 'application/json',
      },
    });

    expect(validateRequestOrigin(request)).toMatchObject({
      allowed: false,
      origin: 'https://example.com',
    });
  });

  it('requires JSON content for non-OPTIONS requests', () => {
    const request = new Request('https://functions.test/feedback', {
      method: 'POST',
      headers: {
        origin: 'https://glossboss.test',
        'content-type': 'text/plain',
      },
    });

    const response = requireJsonRequest(request);
    expect(response?.status).toBe(415);
  });

  describe('jsonResponse header merging', () => {
    function makeRequest() {
      return new Request('https://functions.test/feedback', {
        method: 'POST',
        headers: { origin: 'https://glossboss.test' },
      });
    }

    it('sets Content-Type to application/json', () => {
      const res = jsonResponse(makeRequest(), { ok: true });
      expect(res.headers.get('content-type')).toBe('application/json');
    });

    it('merges extra headers supplied as a plain object', () => {
      const res = jsonResponse(makeRequest(), { ok: true }, { headers: { 'x-foo': 'bar' } });
      expect(res.headers.get('x-foo')).toBe('bar');
      expect(res.headers.get('content-type')).toBe('application/json');
    });

    it('merges extra headers supplied as a string[][] array', () => {
      const res = jsonResponse(makeRequest(), { ok: true }, { headers: [['x-foo', 'baz']] });
      expect(res.headers.get('x-foo')).toBe('baz');
      expect(res.headers.get('content-type')).toBe('application/json');
    });

    it('merges extra headers supplied as a Headers instance without losing values', () => {
      const extra = new Headers();
      extra.set('x-foo', 'qux');
      const res = jsonResponse(makeRequest(), { ok: true }, { headers: extra });
      expect(res.headers.get('x-foo')).toBe('qux');
      expect(res.headers.get('content-type')).toBe('application/json');
    });

    it('preserves CORS headers from the request origin', () => {
      const res = jsonResponse(makeRequest(), { ok: true });
      expect(res.headers.get('access-control-allow-origin')).toBe('https://glossboss.test');
    });

    it('does not let custom headers clobber CORS policy', () => {
      const res = jsonResponse(
        makeRequest(),
        { ok: true },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
          },
        },
      );
      expect(res.headers.get('access-control-allow-origin')).toBe('https://glossboss.test');
      expect(res.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    });

    it('merges Vary header instead of replacing it', () => {
      const res = jsonResponse(
        makeRequest(),
        { ok: true },
        { headers: { Vary: 'Accept-Encoding' } },
      );
      expect(res.headers.get('vary')).toBe('Origin, Accept-Encoding');
    });
  });
});
