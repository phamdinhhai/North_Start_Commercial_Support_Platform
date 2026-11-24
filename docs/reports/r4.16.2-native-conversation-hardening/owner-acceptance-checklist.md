# Owner acceptance checklist

The following checklist is prepared for Owner review. It is not an acceptance record.

- [ ] Sign in through fixture OIDC.
- [ ] Open `/v1/app/` and navigate to Native Inbox.
- [ ] Confirm a persisted synthetic conversation appears after intake.
- [ ] Confirm canonical identity includes the connection/provider/page namespace.
- [ ] Confirm `UNVERIFIED` authority and `UNKNOWN` completeness remain visible.
- [ ] Confirm bounded history disclosure is explicit.
- [ ] Search CRM for a Lead beyond the initial page.
- [ ] Verify Sales/viewer cannot see an unassigned Lead's conversation.
- [ ] Exercise the existing Lead context, handoff, recipient, work and outcome flow.
- [ ] Confirm no provider call or outbound mutation occurs.

Owner acceptance: `PENDING`.