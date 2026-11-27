/** Fabricated reporting rows; mirrors the bounded MetaInsight reporting window,
 * account/campaign identity and units, without claiming an SDK/API receipt. */
export type AdPlatform = 'meta' | 'google' | 'tiktok';
export interface CampaignFixture {
  id: string; platform: AdPlatform; accountId: string; campaignId: string;
  campaignName: string; dateStart: string; dateStop: string;
  impressions: number; clicks: number; spend: number; currency: 'USD';
  timezone: 'UTC'; authority: 'FABRICATED'; completeness: 'UNKNOWN';
}
export interface CampaignSummary {
  id: string; platform: AdPlatform; accountId: string; campaignId: string;
  campaignName: string; impressions: number; clicks: number; spend: number;
  currency: 'USD'; dateStart: string; dateStop: string;
}
export const platformLabels: Record<AdPlatform, string> = {meta:'Meta Ads', google:'Google Ads', tiktok:'TikTok Ads'};
export const platformColors: Record<AdPlatform, string> = {meta:'#2563eb', google:'#d97706', tiktok:'#7c3aed'};
export const fixtureWindow = {since:'2026-11-14', until:'2026-11-20'};
const campaigns = [
  {platform:'meta', accountId:'act_123', campaignId:'fixture-campaign-ads', campaignName:'Studio Lá Xanh · Khám phá', base:18},
  {platform:'meta', accountId:'act_123', campaignId:'fixture-campaign-meta-2', campaignName:'Studio Lá Xanh · Bộ sưu tập', base:12},
  {platform:'google', accountId:'fixture-google-account', campaignId:'fixture-google-search', campaignName:'Nhà Gốm Mây · Tìm kiếm', base:24},
  {platform:'tiktok', accountId:'fixture-tiktok-account', campaignId:'fixture-tiktok-video', campaignName:'Nhà Gốm Mây · Câu chuyện', base:15},
] as const;
export const campaignFixtures: readonly CampaignFixture[] = campaigns.flatMap(campaign => Array.from({length:7}, (_, day) => {
  const date = `2026-11-${14+day}`;
  return {id:`${campaign.campaignId}-${date}`,platform:campaign.platform,accountId:campaign.accountId,campaignId:campaign.campaignId,campaignName:campaign.campaignName,dateStart:date,dateStop:date,impressions:(campaign.base+day)*120,clicks:(campaign.base+day)*3,spend:Number((campaign.base+day*1.25).toFixed(2)),currency:'USD',timezone:'UTC',authority:'FABRICATED',completeness:'UNKNOWN'};
}));
export function filterCampaigns(rows:readonly CampaignFixture[], platform:string, since:string, until:string, search=''):CampaignFixture[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)||!/^\d{4}-\d{2}-\d{2}$/.test(until)||since>until) return [];
  const needle=search.trim().toLocaleLowerCase('vi');
  return rows.filter(row=>(platform==='all'||row.platform===platform)&&row.dateStart>=since&&row.dateStop<=until&&`${row.campaignName} ${row.accountId} ${row.campaignId}`.toLocaleLowerCase('vi').includes(needle));
}
export function summarizeCampaigns(rows:readonly CampaignFixture[]):CampaignSummary[] {
  const values=new Map<string,CampaignSummary>();
  for (const row of rows) {
    // Native campaign identity is connection/account scoped, never name based.
    const key=`${row.platform}:${row.accountId}:${row.campaignId}`;
    const current=values.get(key);
    if(current){current.impressions+=row.impressions;current.clicks+=row.clicks;current.spend=Number((current.spend+row.spend).toFixed(2));if(row.dateStart<current.dateStart)current.dateStart=row.dateStart;if(row.dateStop>current.dateStop)current.dateStop=row.dateStop;}
    else values.set(key,{id:key,platform:row.platform,accountId:row.accountId,campaignId:row.campaignId,campaignName:row.campaignName,impressions:row.impressions,clicks:row.clicks,spend:row.spend,currency:row.currency,dateStart:row.dateStart,dateStop:row.dateStop});
  }
  return [...values.values()];
}
export function spendByPlatform(rows:readonly CampaignSummary[]) {
  return (Object.keys(platformLabels) as AdPlatform[]).flatMap(platform=>{
    const matches=rows.filter(row=>row.platform===platform);
    return matches.length?[{platform:platformLabels[platform],spend:Number(matches.reduce((sum,row)=>sum+row.spend,0).toFixed(2)),fill:platformColors[platform]}]:[];
  });
}
