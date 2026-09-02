import { db, doc, getDoc } from "./firebase-config.js";

const PRODUCTS_COLLECTION = "products";
const CACHE_KEY_V2 = "accolade_products_v2";
const CACHE_KEY_LEGACY = "accolade_products_cache";
const ACTIVE_PRODUCT_KEY = "accolade_selected_product_v2";
const DEFAULT_SIZES = ["S", "M", "L", "XL"];
const DEFAULT_SIZE_CHART = {
  headers: ["Size", "Length", "Chest", "Sleeve"],
  rows: [
    ["S", "68 cm (26.8\")", "55 cm (21.7\")", "26 cm (10.2\")"],
    ["M", "70 cm (27.6\")", "57 cm (22.4\")", "27 cm (10.6\")"],
    ["L", "72 cm (28.3\")", "59 cm (23.2\")", "28 cm (11.0\")"],
    ["XL", "74 cm (29.1\")", "61 cm (24.0\")", "29 cm (11.4\")"],
  ],
};

let currentProductFingerprint = "";

export function getOptimizedCloudinaryUrl(url, mode = "gallery") {
  if (!url || typeof url !== "string") return url || "photos/any.jpeg";
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }

  let transform = "f_auto,q_auto,w_1000,c_limit";
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

  return url.replace(/\/upload\/(?:[^\/]+\/)?/, `/upload/${transform}/`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCachedProduct(id) {
  try {
    // 1. Check direct active item in sessionStorage / localStorage
    const activeRaw =
      sessionStorage.getItem(ACTIVE_PRODUCT_KEY) ||
      localStorage.getItem(ACTIVE_PRODUCT_KEY);
    if (activeRaw) {
      const active = JSON.parse(activeRaw);
      if (active && active.id === id) return active;
    }

    // 2. Check cached product lists
    const raw =
      sessionStorage.getItem(CACHE_KEY_V2) ||
      localStorage.getItem(CACHE_KEY_V2) ||
      localStorage.getItem(CACHE_KEY_LEGACY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.products)
      ? parsed.products
      : Array.isArray(parsed)
        ? parsed
        : [];
    return list.find((p) => p.id === id) || null;
  } catch (e) {}
  return null;
}

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const els = {
  skeleton: document.getElementById("product-skeleton"),
  status: document.getElementById("product-status"),
  page: document.getElementById("product-page"),
  track: document.getElementById("pd-track"),
  thumbs: document.getElementById("pd-thumbs"),
  title: document.getElementById("pd-title"),
  offer: document.getElementById("pd-offer"),
  price: document.getElementById("pd-price"),
  badge: document.getElementById("pd-badge"),
  unit: document.getElementById("pd-unit"),
  cotton: document.getElementById("pd-cotton"),
  description: document.getElementById("pd-description"),
  designList: document.getElementById("pd-design-list"),
  sizeOptions: document.getElementById("pd-size-options"),
  sizeHint: document.getElementById("pd-size-hint"),
  colorSection: document.getElementById("pd-color-section"),
  colorOptions: document.getElementById("pd-color-options"),
  colorHint: document.getElementById("pd-color-hint"),
  selectedColorName: document.getElementById("pd-selected-color-name"),
  qtyValue: document.getElementById("pd-qty-value"),
  qtyMinus: document.getElementById("pd-qty-minus"),
  qtyPlus: document.getElementById("pd-qty-plus"),
  addBtn: document.getElementById("pd-add"),
  buyBtn: document.getElementById("pd-buy"),
  zoomBtn: document.getElementById("pd-zoom-btn"),
  prev: document.querySelector("[data-pd-prev]"),
  next: document.querySelector("[data-pd-next]"),
  toast: document.getElementById("toast"),
  cartBadge: document.getElementById("cart-badge"),
  cartButton: document.getElementById("cart-button"),
  lightbox: document.getElementById("img-lightbox"),
  lbClose: document.getElementById("lb-close"),
};

let product = null;
let quantity = 1;
let selectedSize = "";
let selectedColor = "";
let slideIndex = 0;
let slidesCount = 0;
let unitPrice = 0;
let toastTimer = null;

function toNumber(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function calculateDiscount(priceCurrent, priceOriginal) {
  if (!priceCurrent || !priceOriginal || priceOriginal <= priceCurrent) {
    return null;
  }
  return Math.round(((priceOriginal - priceCurrent) / priceOriginal) * 100);
}

function generateSingleProductFingerprint(p) {
  if (!p) return "";
  const images = Array.isArray(p.images) ? p.images.join(",") : "";
  const sizes = Array.isArray(p.sizes) ? p.sizes.join(",") : "";
  const colors = Array.isArray(p.colors) ? p.colors.join(",") : "";
  const design = Array.isArray(p.designPoints) ? p.designPoints.join("|") : "";
  return `${p.id}:${p.name}:${p.priceCurrent}:${p.priceOriginal}:${p.badge || ""}:${p.cotton}:${images}:${sizes}:${colors}:${design}:${p.sizeChartText || ""}`;
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
  const priceCurrent = toNumber(data.priceCurrent ?? data.price, 0);
  const rawPriceOriginal = data.priceOriginal ?? data.offer;
  const priceOriginal = (rawPriceOriginal !== undefined && rawPriceOriginal !== null && rawPriceOriginal !== "") ? toNumber(rawPriceOriginal, 0) : 0;
  const validPriceOriginal = priceOriginal > priceCurrent ? priceOriginal : 0;
  const discount = calculateDiscount(priceCurrent, validPriceOriginal);
  const description = String(data.description || "").trim();

  return {
    id: docSnap.id,
    name: String(data.name || "Unnamed product"),
    priceCurrent,
    priceOriginal: validPriceOriginal,
    badge: String(data.badge || "").trim(),
    cotton: String(data.cotton || "add details"),
    description,
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
    isPublished: data.isPublished !== false,
  };
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 3000);
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("accolade_cart") || "[]");
  } catch (e) {
    return [];
  }
}

function getCartCount(cart) {
  return Array.isArray(cart)
    ? cart.reduce((sum, item) => sum + (item.quantity || 1), 0)
    : 0;
}

function updateCartBadge() {
  const count = getCartCount(loadCart());
  if (els.cartBadge) els.cartBadge.textContent = String(count);
}

function saveCart(cart) {
  const subtotal = cart.reduce((sum, item) => sum + (item.price || 0), 0);
  localStorage.setItem("accolade_cart", JSON.stringify(cart));
  localStorage.setItem("accolade_subtotal", String(subtotal));
  updateCartBadge();
}

function addToCart(name, price, qty, size, color = "") {
  const cart = loadCart();
  const safeQty = Math.max(1, parseInt(qty, 10) || 1);
  cart.push({
    name,
    price: price * safeQty,
    unitPrice: price,
    quantity: safeQty,
    size,
    color: color || "",
  });
  saveCart(cart);
  showToast("Added successfully");
}

function updateTotals() {
  const total = unitPrice * quantity;
  if (els.price) els.price.textContent = String(total);
  if (els.unit) els.unit.textContent = `Unit: BDT ${unitPrice}`;
  if (els.qtyValue) els.qtyValue.textContent = String(quantity);
}

function updateSlider() {
  if (!els.track || slidesCount === 0) return;
  const slides = els.track.querySelectorAll(".pd-slide");
  slides.forEach((slide, index) => {
    slide.classList.toggle("is-active", index === slideIndex);
  });
  els.track.style.transform = `translateX(-${slideIndex * 100}%)`;
  if (els.thumbs) {
    const thumbs = els.thumbs.querySelectorAll(".pd-thumb");
    thumbs.forEach((thumb, index) => {
      const isActive = index === slideIndex;
      thumb.classList.toggle("is-active", isActive);
      if (isActive) {
        thumb.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    });
  }
}

function setSlide(index) {
  if (slidesCount === 0) return;
  slideIndex = (index + slidesCount) % slidesCount;
  updateSlider();
}

function buildGallery(images) {
  if (!els.track) return;
  els.track.innerHTML = "";
  if (els.thumbs) els.thumbs.innerHTML = "";

  const list = Array.isArray(images)
    ? images.filter(Boolean)
    : String(images || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const items = list.length ? list : ["photos/any.jpeg"];
  slidesCount = items.length;
  slideIndex = 0;

  if (els.prev) els.prev.style.display = slidesCount > 1 ? "flex" : "none";
  if (els.next) els.next.style.display = slidesCount > 1 ? "flex" : "none";
  if (els.thumbs) els.thumbs.style.display = slidesCount > 1 ? "flex" : "none";

  items.forEach((rawSrc, index) => {
    const gallerySrc = getOptimizedCloudinaryUrl(rawSrc, "gallery");
    const thumbSrc = getOptimizedCloudinaryUrl(rawSrc, "thumb");
    const zoomSrc = getOptimizedCloudinaryUrl(rawSrc, "zoom");

    const slide = document.createElement("div");
    slide.className = "pd-slide";
    const img = document.createElement("img");
    img.src = gallerySrc;
    img.alt = `Product image ${index + 1}`;
    img.loading = index === 0 ? "eager" : "lazy";
    img.decoding = "async";
    img.addEventListener("click", () => openLightbox(zoomSrc));
    slide.appendChild(img);
    els.track.appendChild(slide);

    if (els.thumbs && slidesCount > 1) {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "pd-thumb";
      thumb.setAttribute("aria-label", `View image ${index + 1}`);
      const thumbImg = document.createElement("img");
      thumbImg.src = thumbSrc;
      thumbImg.alt = `Thumbnail ${index + 1}`;
      thumbImg.loading = "lazy";
      thumbImg.decoding = "async";
      thumb.appendChild(thumbImg);
      thumb.addEventListener("click", () => setSlide(index));
      els.thumbs.appendChild(thumb);
    }
  });

  updateSlider();
}

function buildSizeOptions(productSizes = []) {
  if (!els.sizeOptions) return;
  els.sizeOptions.innerHTML = "";
  const list =
    Array.isArray(productSizes) && productSizes.length > 0
      ? productSizes.filter(Boolean)
      : DEFAULT_SIZES;

  list.forEach((size) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pd-size-btn";
    btn.textContent = size;
    btn.dataset.size = size;
    if (selectedSize === size) {
      btn.classList.add("is-selected");
    }
    btn.addEventListener("click", () => {
      selectedSize = size;
      els.sizeOptions.querySelectorAll(".pd-size-btn").forEach((el) => {
        el.classList.toggle("is-selected", el.dataset.size === size);
      });
      if (els.sizeHint) {
        els.sizeHint.textContent = "";
        els.sizeHint.hidden = true;
      }
    });
    els.sizeOptions.appendChild(btn);
  });
}

function parseSizeChart(rawText) {
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return DEFAULT_SIZE_CHART;
  }
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return DEFAULT_SIZE_CHART;
  }

  const parseLine = (line) => {
    const delimiter = line.includes("|") ? "|" : ",";
    return line
      .split(delimiter)
      .map((cell) => cell.trim())
      .filter(Boolean);
  };

  const headers = parseLine(lines[0]);
  const rows = lines
    .slice(1)
    .map(parseLine)
    .filter((row) => row.length > 0);

  if (headers.length === 0 || rows.length === 0) {
    return DEFAULT_SIZE_CHART;
  }

  return { headers, rows };
}

function buildSizeChart(sizeChartText) {
  const container = document.getElementById("pd-size-chart-container");
  if (!container) return;

  const chart = parseSizeChart(sizeChartText);

  container.innerHTML = `
    <table class="size-chart-table">
      <thead>
        <tr>
          ${chart.headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${chart.rows
          .map(
            (row) => `
          <tr>
            <th scope="row">${escapeHtml(row[0] || "")}</th>
            ${row
              .slice(1)
              .map((cell) => `<td>${escapeHtml(cell || "")}</td>`)
              .join("")}
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function buildColorOptions(colors = []) {
  if (!els.colorSection || !els.colorOptions) return;
  const list = Array.isArray(colors) ? colors.filter(Boolean) : [];

  if (list.length === 0) {
    els.colorSection.hidden = true;
    selectedColor = "";
    return;
  }

  els.colorSection.hidden = false;
  els.colorOptions.innerHTML = "";

  if (!selectedColor || !list.includes(selectedColor)) {
    selectedColor = list[0];
  }
  if (els.selectedColorName) {
    els.selectedColorName.textContent = selectedColor ? `— ${selectedColor}` : "";
  }

  list.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pd-color-btn";
    btn.textContent = color;
    btn.dataset.color = color;
    if (color === selectedColor) {
      btn.classList.add("is-selected");
    }

    btn.addEventListener("click", () => {
      selectedColor = color;
      if (els.selectedColorName) {
        els.selectedColorName.textContent = `— ${color}`;
      }
      els.colorOptions.querySelectorAll(".pd-color-btn").forEach((el) => {
        el.classList.toggle("is-selected", el.dataset.color === color);
      });
      if (els.colorHint) {
        els.colorHint.textContent = "";
        els.colorHint.hidden = true;
      }
    });

    els.colorOptions.appendChild(btn);
  });
}

function requireColor() {
  if (els.colorSection && !els.colorSection.hidden) {
    if (selectedColor) return true;
    if (els.colorHint) {
      els.colorHint.textContent = "Please select a color.";
      els.colorHint.hidden = false;
    }
    showToast("Please select a color");
    return false;
  }
  return true;
}

function requireSize() {
  if (selectedSize) return true;
  if (els.sizeHint) {
    els.sizeHint.textContent = "Please select a size.";
    els.sizeHint.hidden = false;
  }
  showToast("Please select a size");
  return false;
}

function renderProduct(data, preserveSelection = false) {
  if (!data) return;

  const fp = generateSingleProductFingerprint(data);
  if (fp === currentProductFingerprint && currentProductFingerprint !== "") {
    return;
  }
  currentProductFingerprint = fp;

  product = data;
  unitPrice = data.priceCurrent;
  if (!preserveSelection) {
    quantity = 1;
    selectedSize = "";
    selectedColor = "";
  }

  document.title = `${data.name} | Accolade`;

  if (els.title) els.title.textContent = data.name;
  if (els.offer) {
    const hasDiscount = data.priceOriginal > data.priceCurrent;
    els.offer.textContent = hasDiscount ? data.priceOriginal : "";
    els.offer.style.display = hasDiscount ? "inline-flex" : "none";
  }
  if (els.badge) {
    const bText = String(data.badge || "").trim();
    if (bText) {
      els.badge.textContent = bText;
      els.badge.style.display = "inline-flex";
    } else {
      els.badge.textContent = "";
      els.badge.style.display = "none";
    }
  }
  if (els.cotton) els.cotton.textContent = data.cotton;

  if (els.description) {
    let descText = data.description;
    if (!descText && (data.cotton || (data.designPoints && data.designPoints.length))) {
      const parts = [];
      if (data.cotton && data.cotton !== "add details") parts.push(`Material: ${data.cotton}`);
      if (data.designPoints && data.designPoints.length) parts.push(data.designPoints.join("\n"));
      descText = parts.join("\n\n");
    }
    els.description.textContent = descText || "No description provided.";
  }

  buildGallery(data.images);
  buildSizeOptions(data.sizes);
  buildColorOptions(data.colors);
  buildSizeChart(data.sizeChartText);
  updateTotals();

  if (els.skeleton) els.skeleton.hidden = true;
  if (els.status) els.status.hidden = true;
  if (els.page) els.page.hidden = false;
}

function showError(message) {
  if (els.skeleton) els.skeleton.hidden = true;
  if (els.status) {
    els.status.textContent = message;
    els.status.hidden = false;
  }
  if (els.page) els.page.hidden = true;
}

async function loadProduct() {
  if (!productId) {
    showError("Product not found. Go back to shop and try again.");
    return;
  }

  const cached = getCachedProduct(productId);
  if (cached) {
    renderProduct(cached, false);
  }

  try {
    const snap = await getDoc(doc(db, PRODUCTS_COLLECTION, productId));
    if (!snap.exists()) {
      if (!cached) showError("This product is no longer available.");
      return;
    }
    const data = normalizeProduct(snap);
    if (!data.isPublished) {
      if (!cached) showError("This product is no longer available.");
      return;
    }
    renderProduct(data, Boolean(cached));
  } catch (error) {
    console.error("Failed to load product", error);
    if (!cached) {
      showError("Could not load product. Please try again.");
    }
  }
}

/* ── Lightbox zoom ─────────────────────────────── */
function setupLightbox() {
  const lb = els.lightbox;
  const lbImg = lb ? lb.querySelector("img") : null;
  if (!lb || !lbImg) return;

  let lbScale = 1;
  let lbX = 0;
  let lbY = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let lastTouchDist = null;

  function applyTransform() {
    lbImg.style.transform = `translate(${lbX}px, ${lbY}px) scale(${lbScale})`;
  }

  window.openLightbox = function openLightbox(src) {
    const zoomUrl = getOptimizedCloudinaryUrl(src, "zoom");
    lbImg.src = zoomUrl;
    lbScale = 1;
    lbX = 0;
    lbY = 0;
    applyTransform();
    lb.classList.add("lb-open");
    document.body.style.overflow = "hidden";
  };

  function closeLightbox() {
    lb.classList.remove("lb-open");
    document.body.style.overflow = "";
  }

  if (els.zoomBtn) {
    els.zoomBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const active =
        els.track?.querySelector(".pd-slide.is-active img") ||
        els.track?.querySelector(".pd-slide img");
      if (active) window.openLightbox(active.src);
    });
  }

  lb.addEventListener("click", (e) => {
    if (e.target === lb) closeLightbox();
  });
  if (els.lbClose) els.lbClose.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lb.classList.contains("lb-open")) closeLightbox();
  });

  lb.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      lbScale = Math.min(Math.max(lbScale + delta, 0.5), 5);
      applyTransform();
    },
    { passive: false },
  );

  lbImg.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX - lbX;
    startY = e.clientY - lbY;
    lbImg.classList.add("lb-dragging");
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    lbX = e.clientX - startX;
    lbY = e.clientY - startY;
    applyTransform();
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
    lbImg.classList.remove("lb-dragging");
  });

  lbImg.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX - lbX;
        startY = e.touches[0].clientY - lbY;
        lastTouchDist = null;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    },
    { passive: true },
  );
  lbImg.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        lbX = e.touches[0].clientX - startX;
        lbY = e.touches[0].clientY - startY;
        applyTransform();
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (lastTouchDist) {
          lbScale = Math.min(Math.max(lbScale * (dist / lastTouchDist), 0.5), 5);
          applyTransform();
        }
        lastTouchDist = dist;
      }
    },
    { passive: false },
  );

  let lastTap = 0;
  lbImg.addEventListener("touchend", () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      lbScale = 1;
      lbX = 0;
      lbY = 0;
      applyTransform();
    }
    lastTap = now;
  });
}

function openLightbox(src) {
  if (typeof window.openLightbox === "function") {
    window.openLightbox(src);
  }
}

function setupAccordion() {
  document.querySelectorAll("[data-accordion]").forEach((header) => {
    header.addEventListener("click", () => {
      const name = header.dataset.accordion;
      const panel = document.querySelector(`[data-accordion-panel="${name}"]`);
      if (!panel) return;
      const isOpen = header.classList.contains("is-active");
      header.classList.toggle("is-active", !isOpen);
      panel.classList.toggle("is-active", !isOpen);
      panel.style.maxHeight = !isOpen ? `${panel.scrollHeight}px` : "0px";
    });
  });
}

function setupNav() {
  const hamburger = document.querySelector(".hamburger");
  const mobileMenu = document.getElementById("mobile-menu");
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    mobileMenu.classList.toggle("open");
    const icon = hamburger.querySelector("i");
    if (mobileMenu.classList.contains("open")) {
      icon.classList.replace("fa-bars", "fa-times");
    } else {
      icon.classList.replace("fa-times", "fa-bars");
    }
  });

  document.addEventListener("click", (e) => {
    if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
      if (mobileMenu.classList.contains("open")) {
        mobileMenu.classList.remove("open");
        hamburger.querySelector("i").classList.replace("fa-times", "fa-bars");
      }
    }
  });
}

function bindActions() {
  if (els.qtyPlus) {
    els.qtyPlus.addEventListener("click", () => {
      quantity += 1;
      updateTotals();
    });
  }
  if (els.qtyMinus) {
    els.qtyMinus.addEventListener("click", () => {
      if (quantity > 1) {
        quantity -= 1;
        updateTotals();
      }
    });
  }
  if (els.prev) {
    els.prev.addEventListener("click", () => setSlide(slideIndex - 1));
  }
  if (els.next) {
    els.next.addEventListener("click", () => setSlide(slideIndex + 1));
  }
  if (els.addBtn) {
    els.addBtn.addEventListener("click", () => {
      if (!product || !requireSize() || !requireColor()) return;
      addToCart(product.name.toLowerCase(), unitPrice, quantity, selectedSize, selectedColor);
    });
  }
  if (els.buyBtn) {
    els.buyBtn.addEventListener("click", () => {
      if (!product || !requireSize() || !requireColor()) return;
      addToCart(product.name.toLowerCase(), unitPrice, quantity, selectedSize, selectedColor);
      window.location.href = "shop.html?checkout=true";
    });
  }
  if (els.cartButton) {
    els.cartButton.addEventListener("click", () => {
      window.location.href = "shop.html?checkout=true";
    });
  }

  // Swipe on gallery (mobile)
  let startX = 0;
  if (els.track) {
    els.track.addEventListener(
      "touchstart",
      (e) => {
        startX = e.touches[0].clientX;
      },
      { passive: true },
    );
    els.track.addEventListener(
      "touchend",
      (e) => {
        const delta = e.changedTouches[0].clientX - startX;
        if (Math.abs(delta) > 40) {
          setSlide(slideIndex + (delta < 0 ? 1 : -1));
        }
      },
      { passive: true },
    );
  }
}

setupLightbox();
setupAccordion();
setupNav();
bindActions();
updateCartBadge();
loadProduct();
