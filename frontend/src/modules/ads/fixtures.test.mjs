import {test} from 'node:test';
import assert from 'node:assert/strict';
import {campaignFixtures,filterCampaigns,summarizeCampaigns,spendByPlatform} from './fixtures.ts';
test('platform/date/search filters act on bounded fabricated rows',()=>{
  const rows=filterCampaigns(campaignFixtures,'meta','2026-11-15','2026-11-16','Khám phá');
  assert.equal(rows.length,2);assert.ok(rows.every(row=>row.platform==='meta'&&row.campaignId==='fixture-campaign-ads'));
  assert.equal(filterCampaigns(campaignFixtures,'all','2026-11-20','2026-11-14').length,0);
  assert.equal(filterCampaigns(campaignFixtures,'all','2025-01-01','2025-12-31').length,0);
});
test('same campaign name and native ID in foreign account do not collapse',()=>{
  const row=campaignFixtures[0];const summary=summarizeCampaigns([row,{...row,accountId:'foreign-fixture-account'}]);
  assert.equal(summary.length,2);assert.notEqual(summary[0].id,summary[1].id);
});
test('aggregation preserves exact scope/window and does not infer revenue',()=>{
  const rows=filterCampaigns(campaignFixtures,'meta','2026-11-14','2026-11-20','Khám phá');const summary=summarizeCampaigns(rows);
  assert.equal(summary.length,1);assert.equal(summary[0].spend,152.25);assert.equal(summary[0].dateStart,'2026-11-14');assert.equal(summary[0].dateStop,'2026-11-20');
  assert.equal(spendByPlatform(summary)[0].spend,152.25);assert.ok(!('revenue' in summary[0]));
  assert.ok(campaignFixtures.every(row=>row.authority==='FABRICATED'&&row.completeness==='UNKNOWN'&&row.currency==='USD'));
});
