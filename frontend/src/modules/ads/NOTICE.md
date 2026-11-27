# Ads UI reuse

The campaign performance table and cross-platform Overview chart structure are adapted from:

- Repository: https://github.com/masgant99/nalarin-agentic-ads-studio
- Immutable commit: `c500cc5a132142ff3de815bf6d15c50d490ea522`
- Original paths: `frontend/src/components/PerformanceTable.jsx`, `frontend/src/pages/Overview.jsx`
- Destinations: `PerformanceTable.tsx`, `AdsPage.tsx`

Changes: TypeScript boundaries, Vietnamese labels, Atomic-compatible theme tokens, accessible keyboard sorting, exact native account/campaign identity, deterministic fabricated rows, working platform/date/search filters, read-only detail panel, explicit authority/completeness/units. North Start does not import upstream auth, Supabase, API clients, server, optimization controls, conversion/CPA claims or random Reporting charts. The chart retains Recharts as a separately licensed dependency; Lucide provides icons. No provider credentials or calls are used.

The Meta-shaped fixture fields mirror North Start's existing `MetaInsight` bounded read contract (account/campaign IDs, reporting window, spend/impressions, currency and configured timezone). Google/TikTok rows are UI fixtures only. This module does not claim actual SDK execution, backend Ads reporting, database persistence or live integration.

Upgrades: compare these two original files at a newly pinned commit, review changes to sorting/chart contracts and repeat fixture/browser tests. Do not replace North Start auth or domain contracts with upstream APIs.

## Upstream MIT license

Copyright (c) 2024 Jason Akatiff - iSCALE.com / A4D.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
