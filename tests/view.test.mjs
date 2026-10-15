// node --test tests/view.test.mjs — display helpers behind MarketBrief / PipelineMap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceStatus, sourceRows, sourceSummary, newestRow, istStamp, isTodayIST, outlookTone, whatsappText } from '../app/src/custom/lib/view.js';

test('parseSourceStatus reads every note the flow writes', () => {
  const p = parseSourceStatus('Economic Times Markets 18 · Moneycontrol 0 (failed: HTTP 500) · Reuters India 0 (not an RSS feed) · Google Finance News 0 (empty) · Global Market Cues 7 (3 stale)');
  assert.equal(p.length, 5);
  assert.deepEqual(p.map((x) => x.count), [18, 0, 0, 0, 7]);
  assert.deepEqual(p.map((x) => x.failed), [false, true, true, true, false]);
  assert.equal(p[1].note, 'failed: HTTP 500');
  assert.equal(p[4].stale, true);
  assert.equal(p[4].count, 7);
});
test('parseSourceStatus handles timeout and bare failed; ignores prose', () => {
  assert.equal(parseSourceStatus('Moneycontrol 0 (timeout)')[0].failed, true);
  assert.equal(parseSourceStatus('Moneycontrol 0 (failed)')[0].failed, true);
  assert.equal(parseSourceStatus('Simulated — no source was fetched').length, 0);
  assert.equal(parseSourceStatus(null).length, 0);
});
test('sourceSummary never says all answered when any source is 0 or noted', () => {
  const all = sourceSummary(sourceRows('Economic Times Markets 18 · Moneycontrol 14 · Reuters India 9 · Google Finance News 20 · Global Market Cues 16'));
  assert.equal(all.tone, 'ok'); assert.match(all.text, /All 5/);
  const zero = sourceSummary(sourceRows('Economic Times Markets 18 · Moneycontrol 0 (failed: HTTP 500) · Reuters India 9 · Google Finance News 20 · Global Market Cues 16'));
  assert.equal(zero.tone, 'warn'); assert.doesNotMatch(zero.text, /All 5/);
  const stale = sourceSummary(sourceRows('Economic Times Markets 18 · Moneycontrol 14 · Reuters India 9 · Google Finance News 20 · Global Market Cues 7 (3 stale)'));
  assert.equal(stale.tone, 'warn'); assert.doesNotMatch(stale.text, /All 5/);
  assert.equal(sourceSummary(sourceRows('Moneycontrol 14')).tone, 'warn');
  const none = sourceSummary(sourceRows('Economic Times Markets 0 (empty) · Moneycontrol 0 · Reuters India 0 · Google Finance News 0 · Global Market Cues 0'));
  assert.equal(none.tone, 'bad');
});
test('isTodayIST compares the Report_Date with the IST calendar day', () => {
  const now = new Date('2026-10-14T20:00:00Z'); // 01:30 IST on the 15th
  assert.equal(isTodayIST('2026-10-15', now), true);
  assert.equal(isTodayIST('2026-10-14', now), false);
  assert.equal(isTodayIST(null, now), false);
});
test('whatsappText prefers the stored message; null fields never print', () => {
  const fmt = () => 'FORMATTED';
  assert.equal(whatsappText({ WhatsApp_Message: 'STORED', Status: 'Sent' }, fmt), 'STORED');
  assert.equal(whatsappText({ Status: 'Ready' }, fmt), 'FORMATTED');
  assert.equal(whatsappText({ Status: 'Failed', WhatsApp_Message: '' }, fmt), '');
});
test('newestRow, istStamp, outlookTone survive null input', () => {
  assert.equal(newestRow(null), null);
  assert.equal(newestRow([null, { Report_Date: '2026-10-14' }, { Report_Date: '2026-10-15' }]).Report_Date, '2026-10-15');
  assert.equal(istStamp(null), ''); assert.equal(istStamp('garbage'), '');
  assert.equal(outlookTone(null), 'neutral');
});
