## Password Vault two-phase create can leave entry bound to AAD(0)

### Problem statement recap
The password vault uses a two-phase create for entries: when adding a new password entry, the client first encrypts the payload with AAD derived from entry id 0 (a placeholder), POSTs it to the API, receives the server-assigned real entry id, re-encrypts the same payload with AAD derived from that real id (aadFromEntryId(row.id)), and PATCHes the ciphertext/iv back to the server. After that, the stored blob must decrypt only with the real id's AAD. The ciphertext itself is the same plaintext payload.

This is intentional (server-blind: server never sees id at encryption time). The issue is a race/unload case: if the browser navigates away, unloads the tab, or the Promise chain is aborted between POST (placeholder stored) and the PATCH (rebind to real id), the server will keep the placeholder-bound ciphertext. When the client later lists that entry, it attempts to decrypt with aadFromEntryId(entry.id); since the blob was encrypted with AAD(0), AES-GCM authentication fails (OperationError) and the entry becomes undecryptable ("revealFailed").

Observed in E2E: adding two entries in quick succession and then navigating (theme/locale reload/gotoApp) caused the second entry to remain bound to AAD(0). Intermittent under parallel execution.

### Reproduction
1. Create password vault, unlock.
2. Add entry A (triggers POST placeholder → PATCH rebind). Navigate or reload before PATCH completes.
3. Server stores placeholder ciphertext/iv (bound to AAD(0)).
4. Reload list; decrypt with AAD(A.id) fails; entry undecryptable.
5. Confirm by attempting decryption: AAD(0) succeeds, AAD(id) fails.

### Impact
User sees "تعذّر فك تشفير هذا العنصر." / "Could not decrypt this entry" for affected entries. Data (ciphertext+iv) remains on server but cannot be decrypted by the client under normal flow. No plaintext exposure.

### Mitigations / possible fixes
- Retry/idempotent rebind: on next decrypt/list/reload, detect "decrypt with AAD(id) fails but AAD(0) succeeds" for an entry the client just created or on read, and automatically re-seal/rebind that single entry (encrypt payload with AAD(id) and PATCH ciphertext/iv) without requiring user action. Need care to avoid retry storms and to ensure payload is recoverable (must keep key in memory or re-decrypt via AAD(0) only when safe).
- Do not navigate until rebind completes: client-side UI must await the PATCH (and possibly a refetch) before triggering navigation. Tests fixed by waiting for modal close and row visibility. Production UI should also await.
- Background rebind on read: when listing, for any entry that fails decryption with AAD(id), try AAD(0); if that succeeds, re-encrypt with AAD(id) and PATCH in background (fire-and-forget with error logging), then update local state. This is a self-healing approach but requires the vault to be unlocked.
- Two-phase create with server-side id known earlier? Not possible if server assigns id. Or store client-side pending map and reconcile on reload.
- Consider server accepting a "rebind to id" operation that verifies by allowing re-encryption only when client can prove it holds key? Probably overkill.

### Notes
- This is a pre-existing robustness issue (not introduced by the recent vault component refactor). The refactor preserved crypto and the two-phase create logic verbatim.
- Export/import uses AAD(0) deliberately as the portable format (re-sealed on export). Import would similarly need care.
- No change to crypto primitives.

### Action
- Short-term: ensure UI awaits rebind before navigation; add tests. (Done for the screenshot test.)
- Medium-term: implement self-healing rebind-on-decrypt when AAD(0) works but AAD(id) fails (guarded, rate-limited). Add telemetry/metrics.
- Long-term: consider alternative approach (e.g., client generates a stable AAD per entry, or server returns id before encrypting — but server-blind constraint means client cannot choose id). AAD(0) is the pragmatic placeholder.
