# Transport root-cause analysis

The historical incident cannot be reduced to `not sent`. Evidence shows:

1. The first Node transport hit `UND_ERR_CONNECT_TIMEOUT` before a readable HTTP response.
2. An inline diagnostic run discarded tool metadata; its exact request count is UNKNOWN.
3. The reviewed Python transport completed metadata/history reads, then one POST attempt ended `TRANSPORT_OR_PARSE_STOP` with no readable HTTP/business response.
4. Recovery history was scoped and successful but did not find the unique marker.
5. Owner review returned `NOT_OBSERVED`, which is non-observation rather than proof of non-delivery.
6. A post-run audit found Python stdin locale risk (`cp1258`) that could corrupt non-ASCII bytes; the bridge was corrected offline and not retried.

The strongest classification is **SEND_UNRESOLVED**. The exact provider receive/write state is unavailable. No automatic retry is permitted.
