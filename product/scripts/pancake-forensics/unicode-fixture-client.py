from urllib.request import Request, HTTPRedirectHandler, build_opener
from urllib.parse import urlsplit
import json
import sys

# Offline fixture client: refuses every non-loopback target; no environment credentials.
url = sys.argv[1]
parts = urlsplit(url)
if parts.scheme != 'http' or parts.hostname != '127.0.0.1' or parts.username or parts.password:
    raise ValueError('loopback fixture required')
body = json.dumps({'text': 'Xin chào khách hàng — đã nhận yêu cầu ✅'}, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
request = Request(url, data=body, headers={'Content-Type': 'application/json; charset=utf-8'}, method='POST')
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

with build_opener(NoRedirect()).open(request, timeout=2) as response:
    raw = response.read(65537)
    if len(raw) > 65536:
        raise ValueError('fixture response too large')
    result = json.loads(raw.decode('utf-8'))
    assert result['text'] == json.loads(body)['text']
    print(json.dumps({'status': response.status, 'utf8Exact': raw == body, 'jsonValid': True}))
