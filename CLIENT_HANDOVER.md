# ACCOLADE CLO - CLIENT HANDOVER DOCUMENT

Version: 1.1  
Prepared for: Accolade Clo  
Prepared by: Tanvir Ahmed Siddique

---

## 1) Project summary

**Website name:** Accolade Clo  
**Domain:** `accoladeclo.com`  
**Website type:** Product catalog + manual checkout form flow  

### Tech stack

- HTML5 / CSS3 / JavaScript (static frontend)
- Firebase Authentication (admin sign-in)
- Firebase Firestore (product database)
- Netlify (hosting + serverless functions)
- Cloudinary (image hosting)

---

## 2) Live URLs

- Main website: `https://accoladeclo.com`
- Shop page: `https://accoladeclo.com/shop.html`
- Admin dashboard: `https://accoladeclo.com/admin.html`

---

## 3) High-level architecture

1. Admin logs in via Firebase Auth.
2. Admin adds/edits product data in Firestore.
3. Shop page reads Firestore products and renders:
   - Featured products
   - All categories
   - Hot selling
4. Admin image upload uses:
   - Dashboard -> Netlify Function (`/.netlify/functions/cloudinary-signature`)
   - Signed upload to Cloudinary
   - URL auto-filled in admin form

---

## 4) Account ownership (must stay with client)

1. Hostinger account (domain and DNS)
2. Netlify account (hosting and function secrets)
3. Firebase account (Auth + Firestore)
4. Cloudinary account (media storage)
5. GitHub repo access (if Git-based deployment is used)

---

## 5) Deployment and hosting notes

### Hosting provider

Netlify

### Domain provider

Hostinger (DNS points to Netlify)

### DNS notes

Common Netlify DNS setup:

- `A` record: `@` -> `75.2.60.5`
- `A` record: `@` -> `99.83.190.102`
- `CNAME`: `www` -> `<your-netlify-subdomain>.netlify.app`

### SSL

Managed automatically by Netlify (HTTPS enabled).

---

## 6) Firebase setup requirements

### Authentication

- Email/password sign-in enabled.
- Admin users created manually in Firebase Authentication.

### Authorized domains

In Firebase Auth -> Settings -> Authorized domains, ensure these exist:

- `localhost`
- `<your-netlify-subdomain>.netlify.app`
- `accoladeclo.com`
- `www.accoladeclo.com` (if used)

### Firestore security rules

Use admin-restricted write rules (replace `YOUR_ADMIN_UID`):

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

---

## 7) Netlify environment variables (required)

In Netlify -> Site settings -> Environment variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `ALLOWED_ADMIN_UIDS` (comma separated Firebase UID list of admin users)

### Important

- Do **NOT** add `FIREBASE_WEB_API_KEY` as a Netlify env var.
- Firebase web API key is public and already in frontend config.
- Adding it as env var can trigger Netlify secrets scan failures.

---

## 8) Cloudinary image flow

### Recommended usage from dashboard

1. Open `admin.html`
2. Select image file(s)
3. Click **Upload images**
4. URLs are auto-appended to product image field
5. Optional: click **Upload first as size chart**
6. Save product

### Warning

Do not delete Cloudinary images that are still referenced by live products.

---

## 9) Product management workflow

1. Login to Admin Dashboard
2. Fill product details
3. Upload images (or paste URLs manually)
4. Select publish/category options
5. Save product

### Category behavior

- Featured checkbox -> appears in Featured section
- Hot selling checkbox -> appears in Hot selling section
- Published products -> appear in All categories

---

## 10) Security checklist (production)

- [ ] Firestore rules are admin-UID restricted
- [ ] `ALLOWED_ADMIN_UIDS` is set in Netlify (not empty)
- [ ] Cloudinary secrets are only in Netlify env vars
- [ ] Unauthorized users cannot save products
- [ ] Firebase authorized domains are correct
- [ ] Netlify deploy logs do not expose secrets

---

## 11) Maintenance checklist

### Monthly

- Confirm website and admin panel are accessible
- Confirm image uploads work
- Confirm Firestore reads/writes are normal

### Quarterly

- Review Netlify deploy logs
- Review Firebase usage and billing
- Review Cloudinary usage and storage

### Yearly

- Renew domain before expiry
- Review account access and remove unused users
- Rotate sensitive API secrets if needed

---

## 12) Disaster recovery (quick actions)

If website has issues:

1. Check domain DNS in Hostinger
2. Check Netlify deploy status and logs
3. Check Firebase Auth + Firestore availability
4. Check Cloudinary status and recent deletions
5. Roll back Netlify to last known working deploy

---

## 13) Current production status

- Hosting: Active
- Domain: Connected
- SSL: Enabled
- Firestore: Connected
- Admin panel: Operational
- Product rendering: Firestore-driven
- Image delivery: Cloudinary-backed

