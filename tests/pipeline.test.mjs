// tests/pipeline.test.mjs — pipelineModel (app/src/custom/lib/pipeline.js), the content shared by the Pipeline page and its
// Export PDF: the newest run drives every step's state; nothing is invented when there is no run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pipelineModel, PIPELINE_CONFIG } from '../app/src/custom/lib/pipeline.js';

const ready = { Report_ID: 'MIR-2026-0302', Report_Date: '2026-10-24', Created_At: '2026-10-24T11:15:41.255+05:30', Trigger: 'Manual', Status: 'Ready', Model: 'standard',
  Articles_Analyzed: '40', Message_Length: '2012', Sent_Count: '', Failed_Count: '',
  Source_Status: 'Economic Times Markets 9 · Moneycontrol 7 (1 stale) · Reuters India 9 · Google Finance News 9 (37 stale) · Global Market Cues 6' };
const old = { ...ready, Report_ID: 'MIR-2026-0101', Report_Date: '2026-10-16', Created_At: '2026-10-16T06:01:40+05:30', Status: 'Sent', Sent_Count: '48', Failed_Count: '1' };

test('pipelineModel: the newest run drives the header and the 8 steps', () => {
  const m = pipelineModel([old, ready]);
  assert.equal(m.row.Report_ID, 'MIR-2026-0302');
  assert.equal(m.header.status, 'Ready'); assert.equal(m.header.trigger, 'manual');
  assert.deepEqual(m.steps.map((s) => s.step), [1, 2, 3, 4, 5, 6, 7, 8]);
  const by = Object.fromEntries(m.steps.map((s) => [s.key, s]));
  assert.equal(by.schedule.state, 'Started · Manual');
  assert.equal(by.fetch.sources.length, 5); assert.match(by.fetch.state, /2 of 5 sources had stale items/);
  assert.equal(by.parse.state, '40 articles kept'); assert.equal(by.ai.state, 'Done · standard');
  assert.equal(by.format.state, '2,012 characters'); assert.equal(by.save.state, 'Saved · MIR-2026-0302');
  assert.equal(by.broadcast.state, 'Waiting to be sent'); assert.equal(by.log.state, 'Nothing to log yet');
  assert.equal(m.branches[0].state, 'Not needed — latest run did not fail');
  assert.equal(m.config, PIPELINE_CONFIG);
});

test('pipelineModel: a Sent run shows the delivery counts; a Failed one shows its error; no run invents nothing', () => {
  const sent = pipelineModel([{ ...ready, Status: 'Sent', Sent_Count: '1', Failed_Count: '0' }]);
  assert.equal(sent.steps.find((s) => s.key === 'broadcast').state, '1 sent · 0 failed');
  const failed = pipelineModel([{ ...ready, Status: 'Failed', Error_Message: 'NO_NEWS', Articles_Analyzed: '0' }]);
  assert.equal(failed.steps.find((s) => s.key === 'ai').note, 'NO_NEWS');
  assert.equal(failed.branches[0].state, 'Triggered by the latest run');
  const none = pipelineModel([]);
  assert.equal(none.header, null); assert.ok(none.steps.every((s) => s.state === 'No run yet'));
});
