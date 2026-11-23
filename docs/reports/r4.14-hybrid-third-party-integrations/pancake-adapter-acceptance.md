# Pancake adapter acceptance

The Pancake slice is read-only and fixture-backed. It validates page,
conversation and timestamp context, bounded history shape, schema drift and
provider error classes including authentication, authorization, rate limit,
transport and policy-window categories. It never invokes `reply_inbox` and does
not alter the R4.13.3 incident.

The browser smoke verifies a fabricated Pancake page and native conversation
target through the MV3 runtime. The durable receipt suite accepts a synthetic
Pancake observation and verifies duplicate replay and no Lead seeding. Prior
R4.13.2 bounded history evidence remains the only provider read evidence;
completeness is UNKNOWN.
