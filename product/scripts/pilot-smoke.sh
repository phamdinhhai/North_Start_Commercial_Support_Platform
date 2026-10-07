#!/usr/bin/env bash
# Live HTTP smoke test for the P0 pilot loop (run against dist/main.js).
BASE="${BASE:-http://localhost:3111/v1}"
ROOT="${ROOT:-http://localhost:3111}"
DEMO=(-H 'content-type: application/json' -H 'x-demo-workspace: ws-demo')

code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
post() { curl -s -X POST "$@"; }

echo "== 1. health =="
curl -s "$ROOT/health"; echo; echo

echo "== 2. unauthenticated non-demo -> expect 401 =="
code -X POST "$BASE/pilot/scenarios" -H 'content-type: application/json' \
  -d '{"displayName":"d","utterance":"u","speaker":"customer","connection":"c","externalRecordId":"r1"}'
echo; echo

echo "== 3. demo intake =="
RESP=$(post "$BASE/pilot/scenarios" "${DEMO[@]}" -d '{"displayName":"Phu huynh A","utterance":"Thu Sau em goi lai cho chi nhe, chi trao doi voi be da.","speaker":"customer","connection":"manual","externalRecordId":"r2"}')
echo "$RESP"; echo
LEAD=$(printf '%s' "$RESP" | sed -E 's/.*"leadId":"([^"]+)".*/\1/')

echo "== 4. handoff (work item starts proposed) =="
HO=$(post "$BASE/pilot/leads/$LEAD/handoff" "${DEMO[@]}" -d '{"context":"Phu huynh muon con hoc thu","proposedAction":"Goi lai 15:00 thu Sau","responsibleParty":"internal","origin":"explicit-request","dueAt":"2026-10-09T15:00:00+07:00"}')
echo "$HO"; echo
WORK=$(printf '%s' "$HO" | sed -E 's/.*"workItemId":"([^"]+)".*/\1/')

echo "== 5. accept =="
post "$BASE/pilot/leads/$LEAD/accept" "${DEMO[@]}" -d "{\"workId\":\"$WORK\",\"reason\":\"Sales nhan phu trach\"}"; echo; echo

echo "== 6. reschedule OPEN work (old reminder must disappear) =="
post "$BASE/pilot/leads/$LEAD/reschedule" "${DEMO[@]}" -d "{\"workId\":\"$WORK\",\"newDueAt\":\"2026-10-12T16:00:00+07:00\",\"reason\":\"Phu huynh doi sang thu Hai\"}"; echo
WORK_NEW=$(curl -s "$BASE/pilot/leads/$LEAD" "${DEMO[@]}" | grep -oE '"[0-9a-f-]{36}","action":"Goi lai 15:00 thu Sau","responsibleParty":"internal","origin":"explicit-request","status":"open"' | head -1 | cut -d'"' -f2)
echo;

echo "== 7. complete declared on the rescheduled item (no backfill of occurredAt) =="
post "$BASE/pilot/leads/$LEAD/complete" "${DEMO[@]}" -d "{\"workId\":\"$WORK_NEW\",\"evidence\":\"declared\",\"reason\":\"Da goi, hen cuoi tuan dang ky\"}"; echo; echo

echo "== 8. observed completion without evidence pointer -> expect non-2xx fail-closed =="
HO2=$(post "$BASE/pilot/leads/$LEAD/handoff" "${DEMO[@]}" -d '{"context":"gui hoc phi","proposedAction":"Gui bang hoc phi","responsibleParty":"internal","origin":"explicit-commitment"}')
WORK2=$(printf '%s' "$HO2" | sed -E 's/.*"workItemId":"([^"]+)".*/\1/')
code -X POST "$BASE/pilot/leads/$LEAD/complete" "${DEMO[@]}" -d "{\"workId\":\"$WORK2\",\"evidence\":\"observed\"}"
echo " (expect non-2xx)"; echo

echo "== 9. reschedule COMPLETED work -> expect non-2xx (correction, not silent reopen) =="
code -X POST "$BASE/pilot/leads/$LEAD/reschedule" "${DEMO[@]}" -d "{\"workId\":\"$WORK_NEW\",\"newDueAt\":\"2026-10-20T09:00:00+07:00\",\"reason\":\"lo tay\"}"
echo " (expect non-2xx)"; echo

echo "== 10. advance CE-1 hypothesis path (from Accepted) =="
post "$BASE/pilot/leads/$LEAD/advance" "${DEMO[@]}" -d '{"to":"Contacting","reason":"Da goi"}'; echo
post "$BASE/pilot/leads/$LEAD/advance" "${DEMO[@]}" -d '{"to":"Follow-up","reason":"Cho phan hoi"}'; echo

echo "== 11. outcome Won (claimed, not verified) =="
post "$BASE/pilot/leads/$LEAD/outcome" "${DEMO[@]}" -d '{"value":"Won","reason":"Da deposit"}'; echo; echo

echo "== 12. GET view =="
curl -s "$BASE/pilot/leads/$LEAD" "${DEMO[@]}"; echo

echo "== 13. transition beyond CE-1 boundary on a fresh lead -> expect error =="
R3=$(post "$BASE/pilot/scenarios" "${DEMO[@]}" -d '{"displayName":"Lead moi","utterance":"u","speaker":"customer","connection":"manual","externalRecordId":"r3"}')
L3=$(printf '%s' "$R3" | sed -E 's/.*"leadId":"([^"]+)".*/\1/')
code -X POST "$BASE/pilot/leads/$L3/outcome" "${DEMO[@]}" -d '{"value":"Won"}'
echo " (expect non-2xx: New -> Won is outside the hypothesis)"
