import { afterEach, expect, test, vi } from 'vitest';
import { getTransliterateSuggestions } from '../src';

afterEach(() => vi.unstubAllGlobals());
function response(body: unknown, ok = true) {
  return vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => body }));
}
test('applies defaults even with a partial options object and encodes user input', async () => {
  response(['SUCCESS', [['a&b', ['नमस्ते']]]]);
  expect(await getTransliterateSuggestions('a&b', { lang: 'hi' })).toEqual(['नमस्ते', 'a&b']);
  const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
  expect(url.searchParams.get('text')).toBe('a&b');
  expect(url.searchParams.get('num')).toBe('5');
  expect(url.searchParams.get('itc')).toBe('hi-t-i0-und');
});
test('deduplicates, filters malformed candidates, and caps suggestions', async () => {
  response(['SUCCESS', [['x', ['one', 'one', 3, null, '', 'two', 'three']]]]);
  expect(await getTransliterateSuggestions('x', { numOptions: 2, showCurrentWordAsLastSuggestion: false })).toEqual(['one', 'two']);
});
test.each([null, {}, ['FAILURE'], ['SUCCESS', []], ['SUCCESS', [[null, {}]]]])('handles invalid response %j', async body => {
  response(body);
  expect(await getTransliterateSuggestions('namaste')).toEqual(['namaste']);
});
test('handles HTTP and network failures without logging user text', async () => {
  response(null, false);
  expect(await getTransliterateSuggestions('hello', { showCurrentWordAsLastSuggestion: false })).toEqual([]);
  vi.mocked(fetch).mockRejectedValue(new Error('offline'));
  expect(await getTransliterateSuggestions('hello')).toEqual(['hello']);
});
test('skips blank and aborted requests', async () => {
  response(null);
  expect(await getTransliterateSuggestions(' ')).toEqual([]);
  expect(await getTransliterateSuggestions('hello', { signal: AbortSignal.abort() })).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});
test('forwards cancellation and discards an aborted response', async () => {
  const abort = new AbortController();
  vi.stubGlobal('fetch', vi.fn(async () => { abort.abort(); return { ok: true, json: async () => ['SUCCESS', [['x', ['yes']]]] }; }));
  expect(await getTransliterateSuggestions('x', { signal: abort.signal })).toEqual([]);
  expect(vi.mocked(fetch).mock.calls[0][1]?.signal).toBe(abort.signal);
});
test.each([NaN, Infinity, -2, 100])('normalizes invalid count %s', async numOptions => {
  response(null);
  await getTransliterateSuggestions('x', { numOptions });
  const num = Number(new URL(vi.mocked(fetch).mock.calls[0][0] as string).searchParams.get('num'));
  expect(num).toBeGreaterThanOrEqual(1);
  expect(num).toBeLessThanOrEqual(10);
});
