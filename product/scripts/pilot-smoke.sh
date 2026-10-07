#!/usr/bin/env bash
# Live HTTP smoke test — P0 pilot loop over PostgreSQL with app-process restart.
#
# Usage:
#   scripts/pilot-smoke.sh                     # starts postgres + app (DATABASE_URL set → PgPilotStore), asserts everything
#   BASE=http://host:port/v1 scripts/pilot-smoke.sh   # test an already-running app (restart step then skipped)
#
# Design notes:
# - Asserts EVERY expectation; exits non-zero on the first mismatch (no "expect
#   non-2xx" printing without checking).
# - Guardrail refusals must return 4xx with a machine-readable business `code`
#   (EVIDENCE_POINTER_REQUIRED, WORK_ALREADY_CLOSED, CE1_BOUNDARY, …) — never raw 500.
# - Uses dev unsigned-stub Bearer tokens (AUTH_DEV_UNSIGNED_TOKENS=true, set here
#   for THIS LOCAL SMOKE RUN ONLY) so three distinct identities can be tested.
#   Real credential model = OPEN: PM-1 (QA-28) — do NOT ship this auth mode.
# - Two-person handoff: marketing-A creates + hands to sales-B; B views+accepts;
#   unrelated sales-C is forbidden. No role-scope widening (PM-1 pending).
set -u
cd "$(dirname "$0")/.." || exit 1

PG_PORT="${PG_PORT:-55432}"
APP_PORT="${APP_PORT:-3111}"
APP_MANAGED=0
RUN="smoke-$(date +%s)-$$"
WS="ws-$RUN"

if [ -z "${BASE:-}" ]; then
  export POSTGRES_PORT="$PG_PORT"
  docker compose up -d postgres >/dev/null || { echo "FAIL: postgres unavailable"; exit 1; }
  for _ in $(seq 1 30); do
    [ "$(docker inspect --format '{{.State.Health.Status}}' north-star-pg 2>/dev/null)" = "healthy" ] && break
    sleep 2
  done
  export DATABASE_URL="postgres://north_star:north_star@localhost:${PG_PORT}/north_star"
  npm run build >/dev/null 2>&1 || { echo "FAIL: build"; exit 1; }
  # Ensure schema is current before booting the app (idempotent; migrator no-ops if applied).
  node dist/scripts/migrate.js up >/dev/null 2>&1 || { echo "FAIL: migrate up"; exit 1; }
  AUTH_DEV_UNSIGNED_TOKENS=true PORT="$APP_PORT" node dist/main.js > /tmp/pilot-smoke-app.log 2>&1 &
  APP_PID=$!
  trap 'kill "$APP_PID" 2>/dev/null' EXIT
  APP_MANAGED=1
  BASE="http://localhost:${APP_PORT}/v1"
  ROOT="http://localhost:${APP_PORT}"
  sleep 3
else
  ROOT="${ROOT:-${BASE%/v1}}"
fi

PASS=0; FAIL=0
ok()   { echo "  ok: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
expect_eq()       { if [ "$2" = "$3" ]; then ok "$1"; else fail "$1 — expected [$3] got [$2]"; fi; }
expect_contains() { case "$2" in *"$3"*) ok "$1";; *) fail "$1 — [$3] missing in: $2";; esac; }

b64() { node -e 'process.stdout.write(Buffer.from(process.argv[1]).toString("base64"))' "$1"; }
TOK_A="Bearer $(b64 "{\"workspaceId\":\"$WS\",\"userId\":\"marketing-a\",\"role\":\"sales\"}")"
TOK_B="Bearer $(b64 "{\"workspaceId\":\"$WS\",\"userId\":\"sales-b\",\"role\":\"sales\"}")"
TOK_C="Bearer $(b64 "{\"workspaceId\":\"$WS\",\"userId\":\"sales-c\",\"role\":\"sales\"}")"
A=(-H 'content-type: application/json' -H "authorization: $TOK_A")
B=(-H 'content-type: application/json' -H "authorization: $TOK_B")
C=(-H 'content-type: application/json' -H "authorization: $TOK_C")
DEMO=(-H 'content-type: application/json' -H "x-demo-workspace: $WS")
jget() { printf '%s' "$1" | grep -oE "\"$2\":[^,}]*" | head -1 | sed -E "s/\"$2\"://; s/\"//g"; }

step() { echo; echo "== $1 =="; }

step "1. health"
expect_contains "status ok" "$(curl -s "$ROOT/health")" '"status":"ok"'

step "2. R-02: unauthenticated -> 401; demo header -> allowed"
expect_eq "401 without creds" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/pilot/scenarios" -H 'content-type: application/json' -d "{\"displayName\":\"d\",\"utterance\":\"u\",\"speaker\":\"customer\",\"connection\":\"c-$RUN\",\"externalRecordId\":\"x0\"}")" "401"
D=$(curl -s -X POST "$BASE/pilot/scenarios" "${DEMO[@]}" -d "{\"displayName\":\"demo lead\",\"utterance\":\"u\",\"speaker\":\"customer\",\"connection\":\"c-$RUN\",\"externalRecordId\":\"xdemo\"}")
expect_eq "demo intake ok" "$(jget "$D" status)" "New"

step "3. intake as marketing-A"
R=$(curl -s -X POST "$BASE/pilot/scenarios" "${A[@]}" -d "{\"displayName\":\"Phu huynh A\",\"utterance\":\"Thu Sau em goi lai cho chi nhe, chi trao doi voi be da.\",\"speaker\":\"customer\",\"connection\":\"c-$RUN\",\"externalRecordId\":\"msg1\",\"conversationSource\":\"Messenger\"}")
LEAD=$(jget "$R" leadId)
expect_eq "status New" "$(jget "$R" status)" "New"
[ -n "$LEAD" ] && ok "leadId present" || fail "no leadId: $R"

step "4. handoff A -> B: work item proposed, recipient=B, owner still A"
HO=$(curl -s -X POST "$BASE/pilot/leads/$LEAD/handoff" "${A[@]}" -d "{\"context\":\"Phu huynh muon con hoc thu\",\"proposedAction\":\"Goi lai 15:00 thu Sau\",\"responsibleParty\":\"internal\",\"origin\":\"explicit-request\",\"recipientUserId\":\"sales-b\",\"dueAt\":\"2026-10-09T15:00:00+07:00\"}")
WORK=$(jget "$HO" workItemId)
expect_eq "lead still New" "$(jget "$HO" leadStatus)" "New"
expect_eq "recipient sales-b" "$(jget "$HO" recipient)" "sales-b"

step "5. unrelated sales-C cannot see the case (403 — I-09, no role widening)"
expect_eq "C GET -> 403" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/pilot/leads/$LEAD" "${C[@]}")" "403"
V_B=$(curl -s "$BASE/pilot/leads/$LEAD" "${B[@]}")
expect_contains "B can view handoff context" "$V_B" '"context":"Phu huynh muon con hoc thu"'

step "6. B accepts -> owner becomes B"
AC=$(curl -s -X POST "$BASE/pilot/leads/$LEAD/accept" "${B[@]}" -d "{\"workId\":\"$WORK\",\"reason\":\"B nhan trach nhiem\"}")
expect_eq "Accepted" "$(jget "$AC" leadStatus)" "Accepted"
expect_eq "owner=B" "$(jget "$AC" owner)" "sales-b"

step "7. reschedule open work by B -> returns the replacement ID (P1-3)"
RS=$(curl -s -X POST "$BASE/pilot/leads/$LEAD/reschedule" "${B[@]}" -d "{\"workId\":\"$WORK\",\"newDueAt\":\"2026-10-12T16:00:00+07:00\",\"reason\":\"doi sang thu Hai\"}")
REPL=$(jget "$RS" replacementId)
expect_contains "replacementId returned" "$RS" '"replacementId"'
[ -n "$REPL" ] && [ "$REPL" != "$WORK" ] && ok "replacement is a new id" || fail "no usable replacementId: $RS"
expect_eq "old item marked rescheduled" "$(jget "$RS" supersededStatus)" "rescheduled"

step "7b. mutating the OLD superseded id is refused 409 WORK_SUPERSEDED (was silently 200)"
SU=$(curl -s -X POST "$BASE/pilot/leads/$LEAD/complete" "${B[@]}" -d "{\"workId\":\"$WORK\",\"evidence\":\"declared\"}")
expect_contains "409 code" "$SU" 'WORK_SUPERSEDED'
expect_contains "refusal names the replacement" "$SU" "$REPL"

step "8. complete the REPLACEMENT (Q4: occurredAt NOT backfilled); old stays rescheduled"
CM=$(curl -s -X POST "$BASE/pilot/leads/$LEAD/complete" "${B[@]}" -d "{\"workId\":\"$REPL\",\"evidence\":\"declared\",\"reason\":\"da goi, hen cuoi tuan\"}")
expect_eq "completed" "$(jget "$CM" workStatus)" "completed"
expect_eq "evidence declared" "$(jget "$CM" evidence)" "declared"
expect_eq "occurredAt unknown" "$(jget "$CM" occurredAt)" "unknown"
VIEW_AFTER=$(curl -s "$BASE/pilot/leads/$LEAD" "${B[@]}")
expect_contains "old item still rescheduled" "$VIEW_AFTER" "\"id\":\"$WORK\",\"action\":\"Goi lai 15:00 thu Sau\",\"responsibleParty\":\"internal\",\"origin\":\"explicit-request\",\"status\":\"rescheduled\""
expect_contains "replacement completed" "$VIEW_AFTER" "\"id\":\"$REPL\""
# chain has no active item left (P1-3 requirement): count open/accepted/proposed/awaiting for the chain
ACTIVE=$(node -e '
const fs=require("fs");const v=JSON.parse(fs.readFileSync(0,"utf8"));
const [oldId,repl]=process.argv.slice(1);
const chain=v.workItems.filter(w=>w.id===oldId||w.supersedesWorkId===oldId||w.id===repl);
const active=chain.filter(w=>["proposed","accepted","open","awaiting-external"].includes(w.status));
process.stdout.write(String(active.length));
' <<< "$VIEW_AFTER" "$WORK" "$REPL")
expect_eq "no active work left in the supersession chain" "$ACTIVE" "0"

step "9. observed without pointer -> 422 EVIDENCE_POINTER_REQUIRED"
HO2=$(curl -s -X POST "$BASE/pilot/leads/$LEAD/handoff" "${B[@]}" -d "{\"context\":\"gui hoc phi\",\"proposedAction\":\"Gui bang hoc phi\",\"responsibleParty\":\"internal\",\"origin\":\"explicit-commitment\",\"recipientUserId\":\"sales-b\"}")
WORK2=$(jget "$HO2" workItemId)
expect_contains "422 code" "$(curl -s -X POST "$BASE/pilot/leads/$LEAD/complete" "${B[@]}" -d "{\"workId\":\"$WORK2\",\"evidence\":\"observed\"}")" "EVIDENCE_POINTER_REQUIRED"

step "10. reschedule COMPLETED work -> 409 WORK_ALREADY_CLOSED"
expect_contains "409 code" "$(curl -s -X POST "$BASE/pilot/leads/$LEAD/reschedule" "${B[@]}" -d "{\"workId\":\"$REPL\",\"newDueAt\":\"2026-10-20T09:00:00+07:00\",\"reason\":\"lo tay\"}")" 'WORK_ALREADY_CLOSED'

step "11. external expectation -> unobserved (awaiting-external, never failure)"
HO3=$(curl -s -X POST "$BASE/pilot/leads/$LEAD/handoff" "${B[@]}" -d "{\"context\":\"ky vong khach\",\"proposedAction\":\"Chi A trao doi voi be\",\"responsibleParty\":\"external\",\"origin\":\"explicit-request\",\"recipientUserId\":\"sales-b\"}")
WORK3=$(jget "$HO3" workItemId)
expect_eq "awaiting-external" "$(jget "$(curl -s -X POST "$BASE/pilot/leads/$LEAD/unobserved" "${B[@]}" -d "{\"workId\":\"$WORK3\"}")" workStatus)" "awaiting-external"

step "12. CE-1 boundary on fresh lead -> 422 CE1_BOUNDARY"
L2=$(jget "$(curl -s -X POST "$BASE/pilot/scenarios" "${A[@]}" -d "{\"displayName\":\"fresh\",\"utterance\":\"u\",\"speaker\":\"customer\",\"connection\":\"c-$RUN\",\"externalRecordId\":\"msg2\"}")" leadId)
expect_contains "422 code" "$(curl -s -X POST "$BASE/pilot/leads/$L2/outcome" "${A[@]}" -d '{"value":"Won"}')" 'CE1_BOUNDARY'

step "13. valid path to outcome Won (claimed, not verified)"
curl -s -X POST "$BASE/pilot/leads/$LEAD/advance" "${B[@]}" -d '{"to":"Contacting","reason":"da goi"}' >/dev/null
curl -s -X POST "$BASE/pilot/leads/$LEAD/advance" "${B[@]}" -d '{"to":"Follow-up","reason":"cho phan hoi"}' >/dev/null
OV=$(curl -s -X POST "$BASE/pilot/leads/$LEAD/outcome" "${B[@]}" -d '{"value":"Won","reason":"da deposit"}')
expect_eq "Won" "$(jget "$OV" leadStatus)" "Won"
expect_eq "claimed" "$(jget "$OV" assertionStatus)" "claimed"

step "14. restart APP process (PgPilotStore = durable), re-read everything from PG"
if [ "$APP_MANAGED" = "1" ]; then
  kill "$APP_PID" 2>/dev/null; wait "$APP_PID" 2>/dev/null || true
  AUTH_DEV_UNSIGNED_TOKENS=true PORT="$APP_PORT" node dist/main.js > /tmp/pilot-smoke-app2.log 2>&1 &
  APP_PID=$!
  trap 'kill "$APP_PID" 2>/dev/null' EXIT
  sleep 3
  V=$(curl -s "$BASE/pilot/leads/$LEAD" "${B[@]}")
  expect_contains "lead survives restart (Won)" "$V" '"status":"Won"'
  expect_contains "superseded item survives as rescheduled (P1-3)" "$V" "\"id\":\"$WORK\",\"action\":\"Goi lai 15:00 thu Sau\",\"responsibleParty\":\"internal\",\"origin\":\"explicit-request\",\"status\":\"rescheduled\""
  expect_contains "replacement survives as completed" "$V" "\"id\":\"$REPL\""
  CHAIN=$(node -e '
const v=JSON.parse(require("fs").readFileSync(0,"utf8"));const [oldId,repl]=process.argv.slice(1);
const chain=v.workItems.filter(w=>w.id===oldId||w.supersedesWorkId===oldId||w.id===repl);
const done=chain.filter(w=>w.status==="completed").length, sup=chain.filter(w=>w.status==="rescheduled").length, act=chain.filter(w=>["proposed","accepted","open","awaiting-external"].includes(w.status)).length;
process.stdout.write(`${done}/${sup}/${act}`);
' <<< "$V" "$WORK" "$REPL")
  expect_eq "post-restart chain: completed/rescheduled/active" "$CHAIN" "1/1/0"
  expect_contains "outcome survives claimed" "$V" '"assertionStatus":"claimed"'
  expect_contains "envelope ref survives (I-12)" "$V" '"evidenceRefs":['
  AH=$(curl -s "$BASE/pilot/leads/$LEAD/audit" "${B[@]}")
  for t in lead_created handoff_created lead_transition work_completed outcome_created external_no_observation; do
    expect_contains "audit has $t (append-only, I-05)" "$AH" "\"eventType\":\"$t\""
  done
else
  fail "restart step needs script-managed app (BASE given) — durability NOT proven this run"
fi

echo; echo "======================================"
echo "PASS=$PASS FAIL=$FAIL"
if [ "$FAIL" -eq 0 ]; then echo "ALL CHECKS PASSED"; exit 0; else echo "SMOKE FAILED"; exit 1; fi
