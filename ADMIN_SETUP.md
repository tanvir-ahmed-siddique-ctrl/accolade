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
    match /promoCodes/{promoCodeId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == "YOUR_ADMIN_UID";
    }
    match /orders/{orderId} {
      allow create: if request.resource.data.customer.email is string
        && request.resource.data.items is list;
      allow read, update: if request.auth != null && request.auth.uid == "YOUR_ADMIN_UID";
    }
  }
}
```

## 2) Deploy with Netlify drag-and-drop

1. Zip this project and drag-drop into Netlify.
2. Keep these files/folders in upload:
   - `index.html`, `shop.html`, `admin.html`
   - `admin.js`, `shop-products.js`, `firebase-config.js`, `storefront-firebase.js`
   - `netlify.toml`
   - `netlify/functions/cloudinary-signature.js`
   - `photos/` and static assets
3. Open Netlify site URL and verify:
   - `/shop.html`
   - `/admin.html`

## 3) Add custom Hostinger domain to Netliy

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
- `FIREBASE_WEB_API_KEY`
- `ALLOWED_ADMIN_UIDS` (comma separated admin UID list)

Do not put these secrets inside frontend files.

## 6) Cloudinary upload flow (already integrated)

Dashboard now supports direct upload:

- Select image file(s) in admin form
- Click **Upload images** → URLs auto-added under “paste the URL”
- Product photos and optional size-chart artwork can both be uploaded securely

Uploads are signed by Netlify function, so API secret stays private.

## 7) Admin usage

- Open `admin.html`
- Sign in with admin email/password
- Follow steps 1–4 (card info → details → photos → publish)
- Prefer **Upload images**; only paste URLs if you already have them
- Add or edit checkout promo codes from the **Promo codes** panel
- Click **Save product**
- Product appears on `shop.html` (Firestore-driven)

## 8) Professional order emails

Orders are saved in the **Customer orders** notification panel in Admin. To send the matching professional receipt to both the customer and the admin, create a [Resend](https://resend.com) account, verify your sending domain, then add these Netlify environment variables:

- `RESEND_API_KEY`
- `ORDER_EMAIL_FROM` (for example `Accolade <orders@yourdomain.com>`)
- `ORDER_ADMIN_EMAIL` (the inbox that receives every new order; use `runoffdesignes@gmail.com` if that is your admin inbox)

The customer order is still safely saved in Admin if email configuration is not ready; deploy the new `netlify/functions/send-order-email.js` file with the site.

