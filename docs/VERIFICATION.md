# Verification log

2026-10-25, Asia/Seoul.

- `npm test`: 18 / 18 passed.
- `python3 -m unittest discover -s tests -p 'test_*.py'`: 4 / 4 passed.
- `npm run data:build`: passed, 248 senses; normalized IDs and enrichment references validated.
- `npm run build`: TypeScript and Vite passed. Zod upstream PURE-comment warnings only.
- `npm run test:e2e`: 20 / 20 passed (19.1 seconds), 10 flows each in desktop and mobile Chromium. Covers search, sense learning, persistence, keyboard, responsive layout, invalid/valid restore, offline reload, diagnostic gaps, reading evidence errors, vocabulary restore, response timing, multi-tab persistence, candidate search, dark mode, and separate collocation statistics.

Environment: temporary Node 22.16 runtime, Chromium installed under /tmp, Ubuntu shared libraries extracted under /tmp (no system library installation). E2E command in this workspace:

```bash
PATH=/tmp/node-v22.16.0-linux-x64/bin:$PATH \
PLAYWRIGHT_BROWSERS_PATH=/tmp/toeic-browsers \
LD_LIBRARY_PATH=/tmp/toeic-libs/extracted/usr/lib/x86_64-linux-gnu \
FONTCONFIG_FILE=/tmp/toeic-fontconfig/fonts.conf \
npm run test:e2e
```

Outside this restricted environment, follow the standard install-with-deps command in README.
