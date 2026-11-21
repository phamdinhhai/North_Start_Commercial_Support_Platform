"""No network. Fabricated IPC regression for the retired Python/Node bridge."""
import json
import sys

try:
    mode = sys.argv[1]
    if mode == 'legacy-locale':
        value = json.load(sys.stdin)
    elif mode == 'explicit-utf8':
        value = json.loads(sys.stdin.buffer.read().decode('utf-8'))
    else:
        raise ValueError('fixture mode')
    expected = '\u0110\u00e2y l\u00e0 tin nh\u1eafn ki\u1ec3m th\u1eed \u0111\u01b0\u1ee3c \u1ee7y quy\u1ec1n \u2705'
    result = {'parsed': True, 'unicodePreserved': value.get('message') == expected}
except Exception:
    result = {'parsed': False, 'unicodePreserved': False}
sys.stdout.buffer.write(json.dumps(result, ensure_ascii=True).encode('ascii'))
