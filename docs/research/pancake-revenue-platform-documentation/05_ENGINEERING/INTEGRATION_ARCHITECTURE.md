# Integration Architecture

**Owner:** Engineering  
**Maturity:** Pre-spec  
**Evidence status:** Mixed: verified facts, user observations, inference, hypotheses  
**Last consolidated:** 2026-09-09


## Integration roles
- Pancake: primary conversation/customer/agent evidence source.
- Ad platforms: acquisition spend/campaign/ad/creative sources; do not inherit Pancake's ad-measurement boundary.
- Phone/Zalo/other Sales channels: activity/outcome sources where integrations are available; otherwise minimal Sales confirmation.
- CRM: optional downstream/upstream system of record after customer maturity increases.

## Design rule
Preserve external immutable IDs and timestamps; never rely on display names for joins.
