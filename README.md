# AI Accounting Assistant — review interface

The frontend for the `aiacct` backend. An accountant picks a client, uploads a
month of paperwork, watches it get coded, and then reviews the parts the system
was not sure about.

The product is not the categorisation. It is knowing which categorisations to
distrust — so this interface shows the reasoning, the confidence, and who decided
what, rather than presenting a clean answer.

## Running it

The backend has to be up first (separate repository):

```bash
# in the backend repo
# .env: USE_STUB_LLM=true gives deterministic offline runs that finish in ~1s
uvicorn aiacct.api.main:app --reload      # http://localhost:8000
```

Then:

```bash
npm install
cp .env.example .env.local                # AIACCT_API_URL=http://localhost:8000
npm run dev                               # http://localhost:3000
```

Sign in with a seeded account — `weiling@firm.example` or `marcus@firm.example`,
password `aiacct-demo-2026`. There is no sign-up: a firm decides who works on its
clients' books, and the backend has no registration endpoint.

```bash
npm run typecheck    # next typegen && tsc --noEmit
npm run lint
npm run gen:api      # regenerate src/lib/api/schema.d.ts from the live backend
```

## How it talks to the backend

The browser never calls `localhost:8000`. Every request goes through a
**backend-for-frontend** inside this app:

```
browser ──► /api/session/login ──► backend /api/v1/auth/login
            sets aiacct_token (httpOnly)

browser ──► /api/v1/*  ──────────► backend /api/v1/*
            src/app/api/v1/[...path]/route.ts injects the bearer token
```

Three reasons it is built this way:

1. **The backend has no CORS middleware.** A direct call from `localhost:3000`
   fails at the preflight, so something has to sit in front of it. This needs no
   backend change.
2. **The token never reaches client JavaScript.** It lives in an httpOnly cookie.
   `/api/v1/auth/login` is explicitly refused by the proxy so no other path can
   mint one into the browser.
3. **Documents and exports just work.** Because the session is a same-origin
   cookie rather than an `Authorization` header, a PDF renders in an `<iframe>`
   and an export downloads from a plain `<a download>` — neither of which can
   carry a header.

`src/proxy.ts` (Next 16's renamed `middleware`) gates the pages. It deliberately
excludes `/api`, so a fetch that has lost its session gets a 401 to handle rather
than a redirect to HTML.

## Layout

```
src/
  proxy.ts                     page gate (redirect to /login without a session)
  app/
    api/session/login|logout   sets and clears the session cookie
    api/v1/[...path]           the authenticated proxy to the backend
    login/                     the sign-in screen
    (app)/clients/             client list
    (app)/clients/[clientId]/  runs, learned rules, learning curve
      runs/new                 upload and start
      runs/[runId]             progress, extraction fixes, the review queue
  lib/
    api/types.ts               the API surface, hand-written where OpenAPI is empty
    api/client.ts              fetch wrapper; normalises three error envelopes
    api/queries.ts             TanStack Query keys, hooks and mutations
    domain/money.ts            Decimal parsing, formatting, split validation
    domain/vocabulary.ts       the words this interface uses
  components/domain/           account picker, badges, statement cells, previews
```

### Types

`npm run gen:api` regenerates `src/lib/api/schema.d.ts` from the backend's own
schema. It is not sufficient on its own — around a third of the endpoints are
declared without a `response_model`, so their generated schema is an empty
object. `src/lib/api/types.ts` is the hand-written source of truth for the whole
surface and is what the app imports.

Two conventions run through it:

- **Every money field is a string.** Parsed with `decimal.js`, never
  `parseFloat`. An accounting UI that loses cents is worthless.
- **`money_in` and `money_out` stay separate.** They are rendered as two columns,
  the way a statement prints them, and never combined into a signed value.

## Decisions worth not undoing

- **`NEEDS_REVIEW` and `CLIENT_QUERY` are separate bands.** One is a judgement
  the accountant makes in seconds; the other is an email and then a wait of days.
  Merging them hides how much of the work is finishable today.
- **Bulk approve is scoped to one band and never offered on client queries.**
  Those are precisely the ones nobody could resolve.
- **Reasoning is always on screen.** A confidence number says how sure the system
  is, not what it was thinking.
- **`confidence: null` renders as "set by you", never 0%.** A human's answer is
  not a probability.
- **`account_id: null` renders as "unresolved" and approval is disabled.** The
  API returns 400, because "we do not know" is not something anyone can sign off.
- **`reconciles: null` renders as "not verified", never a tick.** A CSV with no
  balance column is unverifiable, not fine.
- **"Always code this merchant this way" is offered on approve as well as on a
  correction,** and the resulting `rule_preview_count` is shown. Confirming an
  item that was already right is the commonest way a rule gets made.
- **No free-text account entry.** The chart of accounts is fixed; letting codes be
  invented would fragment it within a month.

## Known backend limitations this works around

- **The events stream cannot be relied on.** It holds one database session whose
  identity map returns a cached row, so a stream opened while a run is `RUNNING`
  never sees the transition and closes after ~5 minutes with no `done` event.
  Progress is also published in one burst after the run finishes, not
  incrementally. Polling `GET /runs/{id}` every 1.5s is the primary mechanism;
  the stream is read only for its log lines. A one-line backend fix
  (`populate_existing=True` in the poll loop) would restore it.
- **`is_stale` on a merchant rule is not exposed by the API**, so the rules screen
  cannot flag a rule that has started producing corrections.
- **There is no page-crop endpoint**, so the extraction-fix screen shows the whole
  document and offers the transaction's page number as a pointer.
- **There is no resume after an extraction fix.** Nothing re-enters the pipeline
  at gate 1, so carrying on means starting a new run over the same files — which
  reuses the existing extraction, including the correction. Doing so reassigns the
  documents, leaving the previous run with none.
- **No pagination anywhere**, and no `GET /runs`: a client's runs are enumerated
  through `/clients/{id}/metrics`.
- **`auto_post_rate` decays as items are approved**, so it is shown per run but
  not plotted as a trend. `resolved_without_model` is the figure that actually
  tracks learning.
