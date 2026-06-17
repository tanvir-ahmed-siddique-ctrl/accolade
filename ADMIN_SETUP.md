# Accolade Admin + Firebase Setup

## 1) Firebase Auth and Firestore

You already completed these, but confirm:

- Authentication -> Sign-in method -> Email/Password enabled
- Authentication -> Users -> add only admin user(s)
- Firestore Database -> created in production mode

## 2) Authorized domain for Hostinger

In Firebase Console:

- Authentication -> Settings -> Authorized domains
- Add your Hostinger domain (for example `accoladeclo.com`)

Without this, admin login from your live domain may fail.

## 3) Firestore collection structure

Collection: `products`

Each product document uses fields like:

- `name` (string)
- `subtitle` (string)
- `priceCurrent` (number)
- `priceOriginal` (number)
- `badge` (string)
- `images` (array of URLs)
- `sizeChartUrl` (string URL)
- `cotton`, `quality`, `fabric` (string)
- `designPoints` (array, max 3)
- `featured` (boolean)
- `hotSelling` (boolean)
- `categories` (array, includes `all`)
- `isPublished` (boolean)
- `sortOrder` (number)
- `createdAt`, `updatedAt` (timestamp)

## 4) Image strategy without Firebase Storage

Since Firebase Storage is not available in your free tier:

1. Upload product images to Hostinger File Manager  
   example folder: `/public_html/uploads/products/`
2. Use absolute public URLs in admin panel:
   - `https://yourdomain.com/uploads/products/product1.jpg`
   - one URL per line in the image field
3. Use the same approach for size chart image URL

## 5) Admin usage

- Open `admin.html`
- Sign in with admin email/password
- Fill form and click **Save product**
- Set category toggles for Featured/Hot Selling
- Product appears on `shop.html` in the dynamic section

