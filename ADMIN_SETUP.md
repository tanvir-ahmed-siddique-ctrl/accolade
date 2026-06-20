# Accolade Admin + Firebase + Netlify + Cloudinary Setup

## 1) Firebase requirements

Confirm these in Firebase Console:

- Authentication -> Sign-in method -> Email/Password enabled
- Authentication -> Users -> add only admin user(s)
- Firestore Database -> created in production mode

### Firestore security rule (required)

Replace `YOUR_ADMIN_UID` and publish:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == "YOUR_ADMIN_UID";
    }
  }
}
```

## 2) Deploy with Netlify drag-and-drop

1. Zip this project and drag-drop into Netlify.
2. Keep these files/folders in upload:
   - `index.html`, `shop.html`, `admin.html`
   - `admin.js`, `shop-products.js`, `firebase-config.js`
   - `netlify.toml`
   - `netlify/functions/cloudinary-signature.js`
   - `photos/` and static assets
3. Open Netlify site URL and verify:
   - `/shop.html`
   - `/admin.html`

## 3) Add custom Hostinger domain to Netlify

In Netlify:

- Site settings -> Domain management -> Add custom domain

In Hostinger DNS:

- A record `@` -> `75.2.60.5`
- A record `@` -> `99.83.190.102`
- CNAME `www` -> `your-netlify-subdomain.netlify.app`

Then in Netlify:

- Verify DNS
- Enable HTTPS
- Set your preferred primary domain

## 4) Firebase authorized domains (required for login)

Authentication -> Settings -> Authorized domains:

- `localhost`
- `your-netlify-subdomain.netlify.app`
- `yourdomain.com`
- `www.yourdomain.com` (if used)

Without this, admin login fails on live domain.

## 5) Netlify environment variables (server-side secrets)

Netlify -> Site settings -> Environment variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `ALLOWED_ADMIN_UIDS` (comma separated admin UID list)

Do not put these secrets inside frontend files.

Important:

- Do **not** set `FIREBASE_WEB_API_KEY` as a Netlify environment variable.
- Firebase Web API key is public and already exists in `firebase-config.js`.
- Adding it as Netlify env var can trigger Netlify secrets scanning failure.
- `ALLOWED_ADMIN_UIDS` must not be empty in production, otherwise upload function blocks requests.

## 6) Cloudinary upload flow (already integrated)

Dashboard now supports direct upload:

- Select image file(s) in admin form
- Click **Upload images** -> URLs auto-added to product image list
- Click **Upload first as size chart** -> auto-fills size chart URL

Uploads are signed by Netlify function, so API secret stays private.

## 7) Admin usage

- Open `admin.html`
- Sign in with admin email/password
- Upload images (optional) or paste URLs
- Fill product form and click **Save product**
- Set category toggles for Featured/Hot Selling
- Product appears on `shop.html` sections (Firestore-driven)

