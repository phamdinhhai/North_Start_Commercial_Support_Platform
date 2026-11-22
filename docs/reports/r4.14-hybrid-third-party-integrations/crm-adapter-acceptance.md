# CRM adapter acceptance

HubSpot Contacts, Companies and Deals use the official `@hubspot/api-client`
14.1.3 against a local emulator with bounded pagination and sanitized
authentication, forbidden and rate-limit errors. The connector does not merge
Customers or Leads and does not write CRM records. Salesforce/Twenty/Frappe and
commerce contracts are read-only typed fixtures; they are explicitly not
claimed as live connectors.

The upstream HubSpot root LICENSE is Apache-2.0 while its package metadata says
ISC. This discrepancy is retained in the OSS review and requires release/legal
approval before redistribution.
The local base-path check is not a general SDK redirect/egress policy. Provider
portal/account attestation is not demonstrated by the local emulator, so real
provider credentials and ingestion remain disabled.
