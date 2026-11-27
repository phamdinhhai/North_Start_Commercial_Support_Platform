# Upstream schema safety review

Atomic CRM is MIT at commit `832b07a89be2d9265a66bbf879fed0299c14ebfb`. Its Supabase schema includes Companies, Contacts, Deals, Tasks, Notes, Tags, Sales, RLS policies, triggers and a `merge_contacts` function. The schema is mature but assumes Supabase authentication and broad authenticated RLS; Northstar cannot import it unchanged.

Chatwoot community is MIT at commit `5d1afdf3b2f32b88e21899d62fcde12f2c0c33d7`. The sparse checkout used for the frontend study does not contain the Rails model/schema tree; no database claims are made from missing source. Community JS assignment/conversation patterns are useful, but a Rails database would violate one-codebase/one-PostgreSQL authority.

Ads Studio is MIT at commit `c500cc5a132142ff3de815bf6d15c50d490ea522`. Its Python SQLAlchemy model set covers users/roles/permissions, brands/products/customer profiles and Facebook campaign/reporting concepts. It is coupled to a separate FastAPI database and auth; it is rejected for direct import. Only bounded reporting normalization is reusable.

No source was copied into Northstar by this review. No migration changed. No provider request or mutation occurred. The matrix records the required disposition for each subsystem and keeps all work deferred where Northstar's canonical decisions are open.
