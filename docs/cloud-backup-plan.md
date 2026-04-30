# Plan: Cloud Backup / Restore + Auto-Backup on Send

## Decisions

- Auto-backup triggers **after** sending groups (email or SMS)
- Auto-backup only fires if a backend URL is configured (opt-in via presence of URL)
- Backend retention: **latest only** — always overwrite the single stored backup
- Security: **Pre-shared API key** via `Authorization: Bearer <key>` header
- CloudFlare storage: **R2 object storage**
- Transfer method: **base64-encoded .db file in JSON** (avoids binary/multipart complexity with expo-file-system)

## Architecture

### Backend (CloudFlare Worker + R2)

- `PUT /backup` — receives `{ backup: "<base64>" }` JSON, validates API key, stores raw bytes in R2 under key `cart-partners.db`
- `GET /restore` — validates API key, retrieves R2 object, returns `{ backup: "<base64>" }`
- API key stored as a CloudFlare Worker secret (env var `API_KEY`), NOT in wrangler.toml
- HTTPS is automatic via CloudFlare

### App — New SecureStore keys

- `cartPartnerBackupServerUrl` — backend API base URL
- `cartPartnerBackupApiKey` — pre-shared API key

### App — New store functions in `hooks/use-dbStore.ts`

- `cloudBackupDatabase(serverUrl, apiKey)`:
  1. Checkpoint WAL (via closeDbConnection)
  2. Close DB
  3. Read .db file as base64 via expo-file-system legacy API
  4. PUT to `<url>/backup` with Bearer token
  5. Reopen DB (always, even on error)
- `cloudRestoreDatabase(serverUrl, apiKey)`:
  1. GET `<url>/restore` with Bearer token
  2. Write base64 to temp file via expo-file-system legacy API
  3. Call existing `restoreDatabaseFromFile(tempUri)` (validates tables, swaps files, reinits DB)

### App — Auto-backup in groups

- After successful email/SMS send in `app/(tabs)/groups/index.tsx`
- Check if `cartPartnerBackupServerUrl` is loaded from SecureStore
- If present, call `cloudBackupDatabase()` silently in background
- Show non-blocking alert only on failure

## Files

### New files

- `backend/worker.ts` — CloudFlare Worker TypeScript (handles PUT /backup, GET /restore)
- `backend/wrangler.toml` — worker name, R2 bucket binding
- `backend/package.json` — wrangler + @cloudflare/workers-types dev dependencies
- `backend/tsconfig.json` — targets webworker lib
- `backend/README.md` — deployment instructions

### Modified files

- `hooks/use-dbStore.ts` — add `cloudBackupDatabase()`, `cloudRestoreDatabase()`
- `app/(tabs)/more/backup.tsx` — add Cloud Backup and Cloud Restore buttons (shown only when URL is configured)
- `app/(tabs)/more/settings.tsx` — add Backend URL and API Key inputs (in a "Cloud Backup" section)
- `app/(tabs)/groups/index.tsx` — trigger auto-backup after sending

## Phases

### Phase 1 — Backend

1. Create `backend/` folder with `wrangler.toml`, `package.json`, `tsconfig.json`
2. Implement `backend/worker.ts` (PUT /backup, GET /restore, auth middleware)
3. Write `backend/README.md` with deployment steps

### Phase 2 — App core (can run parallel with Phase 1)

4. Add `cloudBackupDatabase()` and `cloudRestoreDatabase()` to `hooks/use-dbStore.ts`
5. Add backend URL + API key fields to `app/(tabs)/more/settings.tsx`
6. Add cloud backup/restore UI to `app/(tabs)/more/backup.tsx`

### Phase 3 — Auto-backup

7. Add auto-backup trigger in `app/(tabs)/groups/index.tsx` after send

## Verification

1. Deploy worker locally with `wrangler dev`, test PUT /backup and GET /restore with curl
2. Test 401 response when wrong/missing API key
3. Test cloud backup from app → confirm R2 object created
4. Test cloud restore → confirm DB tables and data intact after restore
5. Send groups from app with backend URL configured → confirm backup fires silently
6. Send groups without backend URL → confirm no backup attempt
7. Run existing tests: `npm test` (ensure no regressions)

## Security Notes

- The API key must be set via `wrangler secret put API_KEY` — never stored in wrangler.toml
- The app stores the API key in iOS/Android SecureStore (hardware-backed keychain/keystore)
- All CloudFlare Worker traffic is HTTPS by default
- The auth check compares the full Bearer token value; returning 401 on any mismatch
