import { afterEach, describe, expect, it } from 'vitest';
import { getAgentBaseUrl, getApiBaseUrl } from './env';

describe('portal runtime env resolution', () => {
  afterEach(() => {
    delete window.__MANGO_ENV__;
  });

  it('prefers runtime window.__MANGO_ENV__.VITE_API_URL and strips trailing slashes', () => {
    window.__MANGO_ENV__ = { VITE_API_URL: 'https://api.mango.example.com///' };
    expect(getApiBaseUrl()).toBe('https://api.mango.example.com');
  });

  it('falls back to default http://localhost:4000 when runtime env is empty', () => {
    window.__MANGO_ENV__ = { VITE_API_URL: '   ' };
    expect(getApiBaseUrl()).toBe('http://localhost:4000');
  });

  it('prefers runtime window.__MANGO_ENV__.VITE_AGENT_URL when set', () => {
    window.__MANGO_ENV__ = { VITE_AGENT_URL: 'http://127.0.0.1:47821/' };
    expect(getAgentBaseUrl()).toBe('http://127.0.0.1:47821');
  });
});
