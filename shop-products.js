import { collection, db, getDocs } from "./firebase-config.js";

const PRODUCTS_COLLECTION = "products";
const CACHE_KEY_V2 = "accolade_products_v2";
const CACHE_KEY_LEGACY = "accolade_products_cache";
const ACTIVE_PRODUCT_KEY = "accolade_selected_product_v2";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

let currentRenderedFingerprint = "";

export function getOptimizedCloudinaryUrl(url, mode = "card") {
  if (!url || typeof url !== "string") return url || "photos/any.jpeg";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  let transform = "f_auto,q_auto,w_600,c_limit";
  if (mode === "lqip") {
    transform = "f_auto,q_10,w_80,e_blur:200,c_limit";
  } else if (mode === "thumb") {
    transform = "f_auto,q_auto,w_200,c_limit";
  } else if (mode === "gallery") {
    transform = "f_auto,q_auto,w_1000,c_limit";
  } else if (mode === "zoom") {
    transform = "f_auto,q_auto,w_1800,c_limit";
  } else if (mode === "card") {
    transform = "f_auto,q_auto,w_600,c_limit";
  }

  // Replace /upload/ or /upload/v12345/ with /upload/{transform}/
  return url.replace(/\/upload\/(?:[^\/]+\/)?/, `/upload/${transform}/`);
}

function getCachedProducts() {
  try {
    let raw = sessionStorage.getItem(CACHE_KEY_V2);
    if (!raw) {
      raw = localStorage.getItem(CACHE_KEY_V2) || localStorage.getItem(CACHE_KEY_LEGACY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const products = Array.isArray(parsed?.products)
      ? parsed.products
      : Array.isArray(parsed)
        ? parsed
        : null;

    if (products && products.length > 0) {
      return products;
    }
  } catch (e) {}
  return null;
}

function setCachedProducts(products) {
  try {
    const payload = JSON.stringify({
      timestamp: Date.now(),
      products,
    });
    localStorage.setItem(CACHE_KEY_V2, payload);
    sessionStorage.setItem(CACHE_KEY_V2, payload);
  } catch (e) {}
}

function generateFingerprint(products) {
  if (!Array.isArray(products)) return "";
  return products
    .map((p) => {
      const img = Array.isArray(p.images) ? p.images[0] : "";
      const sizes = Array.isArray(p.sizes) ? p.sizes.join(",") : "";
      const colors = Array.isArray(p.colors) ? p.colors.join(",") : "";
      return `${p.id}:${p.name}:${p.priceCurrent}:${p.priceOriginal}:${img}:${sizes}:${colors}:${p.badge}:${p.cotton}:${p.sortOrder}:${p.isPublished}`;
    })
    .join("|");
}

function createSkeletonCard() {
  const card = document.createElement("div");
  card.className = "product-card skeleton-card pointer-events-none";
  card.innerHTML = `
    <div class="product-image" style="background:rgba(255,255,255,0.06);min-height:240px;border-radius:12px;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);animation:skeletonShimmer 1.5s infinite;"></div>
    </div>
    <div class="mt-4 space-y-2">
      <div style="height:14px;background:rgba(255,255,255,0.08);border-radius:4px;width:70%;"></div>
      <div style="height:12px;background:rgba(255,255,255,0.06);border-radius:4px;width:45%;"></div>
    </div>
  `;
  return card;
}

function renderSkeletons(gridElement, count = 3) {
  if (!gridElement) return;
  gridElement.innerHTML = "";
  for (let i = 0; i < count; i++) {
    gridElement.appendChild(createSkeletonCard());
  }
}

const featuredGrid = document.querySelector("#featured-products .product-grid");
const allGrid = document.querySelector("#all-categories .product-grid");
const hotGrid = document.querySelector("#top-rated .product-grid");

// 1. Instant Zero-Latency Render from Cache
const initialCache = getCachedProducts();
if (initialCache && initialCache.length > 0) {
  renderProducts(initialCache, false);
  document.documentElement.classList.remove("firebase-products-loading");
} else {
  document.documentElement.classList.add("firebase-products-loading");
  renderSkeletons(featuredGrid, 3);
  renderSkeletons(allGrid, 6);
  renderSkeletons(hotGrid, 3);
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  return 0;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCategories(data) {
  const categories = new Set(["all"]);
  const rawCategories = Array.isArray(data.categories) ? data.categories : [];
  rawCategories.forEach((item) => {
    const slug = slugify(item);
    if (slug) categories.add(slug);
  });
  if (data.featured === true || categories.has("featured")) {
    categories.add("featured");
  }
  if (
    data.hotSelling === true ||
    categories.has("hot-selling") ||
    categories.has("hotselling")
  ) {
    categories.add("hot-selling");
  }
  return Array.from(categories);
}

function calculateDiscount(priceCurrent, priceOriginal) {
  if (!priceCurrent || !priceOriginal || priceOriginal <= priceCurrent) {
    return null;
  }
  return Math.round(((priceOriginal - priceCurrent) / priceOriginal) * 100);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeProduct(docSnap) {
  const data = docSnap.data() || {};
  const images = Array.isArray(data.images)
    ? data.images.filter(Boolean)
    : String(data.images || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const designPoints = Array.isArray(data.designPoints)
    ? data.designPoints.filter(Boolean)
    : String(data.designPoints || "")
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
  const priceCurrent = toNumber(data.priceCurrent ?? data.price);
  const priceOriginal = toNumber(data.priceOriginal ?? data.offer, priceCurrent);
  const discount = calculateDiscount(priceCurrent, priceOriginal);
  const categories = getCategories(data);

  return {
    id: docSnap.id,
    name: String(data.name || "Unnamed product"),
    priceCurrent,
    priceOriginal,
    badge:
      String(data.badge || "").trim() || (discount ? `${discount}% OFF` : "NEW"),
    cotton: String(data.cotton || "add details"),
    sizes: Array.isArray(data.sizes)
      ? data.sizes.filter(Boolean)
      : String(data.sizes || "")
          .split(/,|\n|\|/)
          .map((item) => item.trim())
          .filter(Boolean),
    colors: Array.isArray(data.colors)
      ? data.colors.filter(Boolean)
      : String(data.colors || "")
          .split(/,|\n|\|/)
          .map((item) => item.trim())
          .filter(Boolean),
    sizeChartText: String(data.sizeChartText || ""),
    images,
    designPoints,
    categories,
    isPublished: data.isPublished !== false,
    sortOrder: Number.isFinite(Number(data.sortOrder))
      ? Number(data.sortOrder)
      : 9999,
    createdAt: getTimestampValue(data.createdAt),
  };
}

// Prefetch and pre-decode images + document on hover/touch
const prefetchedProductIds = new Set();
function prefetchProductAssets(product) {
  if (!product || prefetchedProductIds.has(product.id)) return;
  prefetchedProductIds.add(product.id);

  try {
    sessionStorage.setItem(ACTIVE_PRODUCT_KEY, JSON.stringify(product));
    localStorage.setItem(ACTIVE_PRODUCT_KEY, JSON.stringify(product));
  } catch (e) {}

  // 1. Predictive document HTML prefetch for 0.00s instant navigation
  try {
    const docPrefetch = document.createElement("link");
    docPrefetch.rel = "prefetch";
    docPrefetch.as = "document";
    docPrefetch.href = `product.html?id=${encodeURIComponent(product.id)}`;
    document.head.appendChild(docPrefetch);
  } catch (e) {}

  // 2. Pre-decode top gallery images
  const images = Array.isArray(product.images) ? product.images : [];
  images.slice(0, 3).forEach((imgSrc) => {
    if (!imgSrc) return;
    const preloadImg = new Image();
    preloadImg.decoding = "async";
    preloadImg.src = getOptimizedCloudinaryUrl(imgSrc, "gallery");
  });
}

function createProductCard(product) {
  const images = Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : String(product.images || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const rawPrimaryImage = images[0] || "photos/any.jpeg";
  const primaryImage = getOptimizedCloudinaryUrl(rawPrimaryImage, "card");
  const lqipImage = getOptimizedCloudinaryUrl(rawPrimaryImage, "lqip");

  const priceCurrent = toNumber(product.priceCurrent ?? product.price, 0);
  const priceOriginal = toNumber(
    product.priceOriginal ?? product.offer,
    priceCurrent,
  );
  const discount = calculateDiscount(priceCurrent, priceOriginal);

  const categories = Array.isArray(product.categories)
    ? product.categories
    : String(product.categories || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const labelChip = categories.includes("featured")
    ? "Featured"
    : categories.includes("hot-selling")
      ? "Hot Selling"
      : "Product";

  const card = document.createElement("article");
  card.className = "product-card info-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `View ${product.name || "Product"}`);

  const sizes = Array.isArray(product.sizes)
    ? product.sizes.filter(Boolean)
    : String(product.sizes || "")
        .split(/,|\n|\|/)
        .map((item) => item.trim())
        .filter(Boolean);

  const colors = Array.isArray(product.colors)
    ? product.colors.filter(Boolean)
    : String(product.colors || "")
        .split(/,|\n|\|/)
        .map((item) => item.trim())
        .filter(Boolean);

  const designPoints = Array.isArray(product.designPoints)
    ? product.designPoints.filter(Boolean)
    : String(product.designPoints || "")
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);

  card.dataset.id = product.id || "";
  card.dataset.name = product.name || "Product";
  card.dataset.price = `BDT ${priceCurrent}`;
  card.dataset.priceValue = `${priceCurrent}`;
  card.dataset.offer = `${priceOriginal}`;
  card.dataset.badge = product.badge || "";
  card.dataset.cotton = product.cotton || "";
  card.dataset.sizes = sizes.join(",");
  card.dataset.colors = colors.join(",");
  card.dataset.design = designPoints.join("|");
  card.dataset.images = images.join(",");

  const badgeText = product.badge || (discount ? `${discount}% OFF` : "NEW");

  card.innerHTML = `
    <div class="product-image" style="background:rgba(255,255,255,0.04);position:relative;overflow:hidden;">
      <img
        src="${primaryImage}"
        alt="${escapeHtml(product.name || "Product")}"
        loading="lazy"
        decoding="async"
        class="product-card-img"
        style="opacity: 0; transition: opacity 0.35s ease; width: 100%; height: 100%; object-fit: cover;"
        onload="this.style.opacity='1'; this.parentElement.classList.add('is-loaded');"
      />
      <span class="label-chip">${escapeHtml(labelChip)}</span>
      <span class="badge">${escapeHtml(badgeText)}</span>
    </div>
    <div class="mt-4 space-y-2">
      <h3 class="font-bold text-sm uppercase tracking-wider">${escapeHtml(product.name || "Product")}</h3>
      <div class="price-display">
        <span class="price-currency">BDT</span>
        <span class="price-original">${priceOriginal}</span>
        <span class="price-current">${priceCurrent}</span>
        <span class="price-badge">${escapeHtml(badgeText)}</span>
      </div>
    </div>
  `;

  // Predictive prefetch triggers
  card.addEventListener("mouseenter", () => prefetchProductAssets(product), { passive: true });
  card.addEventListener("touchstart", () => prefetchProductAssets(product), { passive: true });

  const openProductPage = () => {
    prefetchProductAssets(product);
    window.location.href = `product.html?id=${encodeURIComponent(product.id)}`;
  };
  card.addEventListener("click", openProductPage);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProductPage();
    }
  });

  return card;
}

function renderIntoGrid(gridElement, products, emptyMessage) {
  if (!gridElement) return;
  gridElement.innerHTML = "";

  if (!products.length) {
    const emptyState = document.createElement("div");
    emptyState.className =
      "col-span-full border border-[rgba(255,255,255,0.18)] rounded-2xl p-6 text-sm tracking-wide";
    emptyState.textContent = emptyMessage;
    gridElement.appendChild(emptyState);
    return;
  }

  products.forEach((product) => {
    gridElement.appendChild(createProductCard(product));
  });

  if (typeof window.attachImageLoaders === "function") {
    window.attachImageLoaders(gridElement);
  }
}

function renderProducts(products, force = false) {
  if (!Array.isArray(products)) return;

  // DOM Fingerprinting: Prevent flicker if data is unchanged
  const newFingerprint = generateFingerprint(products);
  if (!force && newFingerprint === currentRenderedFingerprint && currentRenderedFingerprint !== "") {
    return;
  }
  currentRenderedFingerprint = newFingerprint;

  const featuredProducts = products.filter((product) => {
    const cats = Array.isArray(product.categories)
      ? product.categories
      : String(product.categories || "").split(",");
    return cats.includes("featured");
  });
  const hotProducts = products.filter((product) => {
    const cats = Array.isArray(product.categories)
      ? product.categories
      : String(product.categories || "").split(",");
    return cats.includes("hot-selling");
  });

  renderIntoGrid(featuredGrid, featuredProducts, "No featured products yet.");
  renderIntoGrid(allGrid, products, "No products found.");
  renderIntoGrid(hotGrid, hotProducts, "No hot selling products yet.");
}

async function loadProducts() {
  if (!featuredGrid && !allGrid && !hotGrid) {
    document.documentElement.classList.remove("firebase-products-loading");
    return;
  }
  const hasCached = Boolean(getCachedProducts());
  if (!hasCached) {
    renderSkeletons(featuredGrid, 3);
    renderSkeletons(allGrid, 6);
    renderSkeletons(hotGrid, 3);
  }
  try {
    const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
    const products = snapshot.docs
      .map(normalizeProduct)
      .filter((product) => product.isPublished)
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return right.createdAt - left.createdAt;
      });
    setCachedProducts(products);
    renderProducts(products, false);
  } catch (error) {
    console.error("Failed to load Firestore products", error);
    if (!hasCached) {
      renderIntoGrid(
        featuredGrid,
        [],
        "Could not load products from Firebase. Check Firestore rules.",
      );
      renderIntoGrid(
        allGrid,
        [],
        "Could not load products from Firebase. Check Firestore rules.",
      );
      renderIntoGrid(
        hotGrid,
        [],
        "Could not load products from Firebase. Check Firestore rules.",
      );
    }
  } finally {
    document.documentElement.classList.remove("firebase-products-loading");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadProducts);
} else {
  loadProducts();
}
