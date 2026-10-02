# Security Specification: Tyler MD Scaled Pairing Engine

## 1. Data Invariants
1. `bot_sessions`: Every document in `/bot_sessions/{sessionId}` must have an immutable `sessionId` matching the document path and a valid `phoneNumber` (E.164 without plus, length 9-16).
2. The `status` field must transition only through valid states: `pending` -> `paired` -> `active` -> `disconnected`.
3. Client direct writes are strictly restricted. The pairing engine server is the primary writer using authenticated server credentials, while public client queries cannot dump all bot sessions.
4. `system_stats`: Read access is permitted for general metrics, but write access is reserved for the backend system.

## 2. The "Dirty Dozen" Attack Payloads
1. **Payload 1 (Ghost Fields)**: Session document injection with `{ isSuperAdmin: true }`. Must be rejected by strict key schema validation.
2. **Payload 2 (Session ID Hijack)**: Path ID `sessionId_123` with payload `{ sessionId: "different_id" }`. Must be rejected by path-data identity match.
3. **Payload 3 (Oversized Phone Number)**: Phone number with 10KB string payload (Denial of Wallet). Must be rejected by `.size() <= 20`.
4. **Payload 4 (Invalid State Transition)**: Changing `status` from `pending` directly to arbitrary attacker string `root_pwned`. Must be rejected by enum check.
5. **Payload 5 (Unauthenticated Mass Dump)**: Attempting `list` on `/bot_sessions` without query constraints. Must be rejected.
6. **Payload 6 (PII Extraction)**: Reading another user's `sessionCreds` without ownership. Must be denied.
7. **Payload 7 (Oversized Base64 Payload)**: Injecting 25MB credential string into `sessionCreds`. Must be rejected by `.size() <= 65536`.
8. **Payload 8 (Invalid Timestamp)**: Setting `createdAt` to future date or non-timestamp string. Must be rejected.
9. **Payload 9 (Stats Manipulation)**: Client updating `totalPaired` to `-999999` directly. Must be rejected.
10. **Payload 10 (Path Injection Attack)**: Document ID containing path traversal characters like `../../hack`. Must be rejected by `isValidId()`.
11. **Payload 11 (Empty Phone Number)**: Session creation with `{ phoneNumber: "" }`. Must be rejected by `phoneNumber.size() >= 8`.
12. **Payload 12 (Direct Deletion Attack)**: Client attempting to wipe all documents in `/bot_sessions`. Must be rejected by `allow delete: if false;`.

## 3. Test Runner Design
All tests ensure `PERMISSION_DENIED` on the above dirty dozen attacks.
