# Unicode and response parser boundary tests

Offline execution, 2026-11-21: **23/23 passed**, zero skipped. Node v22.21.0; Python 3.10.0; Windows. Command from repository root:

```powershell
node --test product/scripts/pancake-forensics/unicode-and-response-parser-tests.mjs
```

The committed Node test server binds only `127.0.0.1` on an ephemeral port. Python's fixture client refuses non-loopback URLs and receives no credentials. All payloads, error codes and responses are fabricated. No provider request, production database or live send was used.

| Executed boundary | Result |
|---|---|
| Vietnamese `Xin chào khách hàng — đã nhận yêu cầu ✅` | Exact UTF-8 response bytes and decoded text match |
| Python JSON UTF-8 POST to Node echo server | Exact request bytes, parsed body and stdout categorical result match |
| JSON POST nested body | HTTP 201 and full object round trip preserved |
| Query access_token/token | Values replaced; safe parameter preserved in local formatter |
| Application/JSON case | Parsed independently of media-type casing |
| HTTP 200, 201, 204, 400, 401, 403, 404, 409, 429, 500, 502, 503, 504 | Distinct status retained; no inference of delivery |
| Malformed JSON | Raw text retained with parse error; no invented JSON |
| text/plain containing JSON syntax | Text retained; JSON parser not invoked |
| HTTP 200 with success:false/error_code:105 | HTTP status and business rejection both retained |
| Stalled loopback response | AbortController timeout rejects the request |
| Child process killed after partial stdout | Partial output contains no HTTP status/request ID; missing metadata cannot establish whether a request happened |

The process test waits for the first stdout chunk before termination, avoiding a startup timing race. The timeout case uses a nonresponding loopback fixture and does not emulate a provider timeout after accepting a mutation.

## Interpretation limits

This is a deliberately standalone harness, not an assertion that a retired private R4.13.2 script, product provider adapter or external service uses the same parser. The JSON/media-type helper belongs to the fixture suite. It has no admission, authorization, delivery or retry authority. Query redaction proves the tested formatter only; it does not audit all logging sinks. Killed stdout demonstrates a loss mechanism, not evidence of the historical process outcome. A lack of stdout must remain UNKNOWN until independent evidence resolves it. Local Unicode equality does not prove the historical shell, source file or provider received those bytes.

No dependency install or domain/API changes were required. Node's built-in runner executes the Python client as one of the tests. No raw tokens, cookies, account IDs or private response bodies are committed.
