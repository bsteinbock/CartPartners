# CartPartners Backup Worker

A CloudFlare Worker that provides cloud backup and restore for the CartPartners SQLite database.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/): `
- A CloudFlare account

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Authenticate with CloudFlare

```bash
wrangler login
```

### 3. Create the R2 bucket

```bash
wrangler r2 bucket create cart-partners-db-backup
```

### 4. Set the API key secret

Choose a strong random string (e.g. from a password manager) and set it as a Worker secret. This value must match what you enter in the app's Settings → Cloud Backup screen.

```bash
wrangler secret put API_KEY
# Enter your secret key when prompted
```

> **Never** put the API key in `wrangler.toml` — it would be committed to source control.

### 5. Deploy the Worker

```bash
npm run deploy
```

After deploying, Wrangler will print the Worker's URL (e.g. `https://cart-partners-backend.<your-subdomain>.workers.dev`). Enter this URL and the API key in the app under **More → Settings → Cloud Backup**.

## Local development

```bash
npm run dev
```

This starts a local Worker at `http://localhost:8787`. R2 is simulated locally by Wrangler.

Test the endpoints with curl:

```bash
# Backup (upload)
curl -X PUT http://localhost:8787/backup \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"backup":"<base64-encoded-db>"}'

# Restore (download)
curl http://localhost:8787/restore \
  -H "Authorization: Bearer YOUR_API_KEY"

# Verify (check a backup exists)
curl http://localhost:8787/verify \
  -H "Authorization: Bearer YOUR_API_KEY"
```

A successful `/verify` response looks like:

```json
{ "success": true, "key": "cart-partners.db", "size": 204800, "uploaded": "2026-05-01T18:14:04.000Z" }
```

If no backup has been uploaded yet, the response will be `404` with `{ "success": false, "error": "No backup found" }`.

## Endpoints

| Method | Path       | Description                                                                   |
| ------ | ---------- | ----------------------------------------------------------------------------- |
| PUT    | `/backup`  | Upload DB as `{ "backup": "<base64>" }`.                                      |
| GET    | `/restore` | Returns latest backup as `{ "backup": "<base64>" }`.                          |
| GET    | `/verify`  | Returns `{ success, key, size, uploaded }` if a backup exists; 404 otherwise. |

Both endpoints require an `Authorization: Bearer <API_KEY>` header and return 401 if it is missing or incorrect.

## Security

- HTTPS is enforced by CloudFlare automatically.
- The API key is stored in CloudFlare's encrypted secrets store and in the app's iOS/Android SecureStore (hardware-backed keychain/keystore).
- Only the latest backup is retained — each upload overwrites the previous one.
