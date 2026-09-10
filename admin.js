import {
  addDoc,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  getDocs,
  onAuthStateChanged,
  serverTimestamp,
  setDoc,
  signInWithEmailAndPassword,
  signOut,
  updateDoc,
} from "./firebase-config.js";

const PRODUCTS_COLLECTION = "products";
const PROMO_CODES_COLLECTION = "promoCodes";
const ORDERS_COLLECTION = "orders";
const state = {
  editingId: null,
  products: [],
  promoCodes: [],
  promoEditingId: null,
  orders: [],
};

const loginForm = document.getElementById("admin-login-form");
const loginError = document.getElementById("admin-login-error");
const loginCard = document.getElementById("admin-login-card");
const dashboardCard = document.getElementById("admin-dashboard");
const logoutButton = document.getElementById("admin-logout");
const userEmailLabel = document.getElementById("admin-user-email");
const productForm = document.getElementById("product-form");
const productStatus = document.getElementById("product-status");
const productList = document.getElementById("product-list");
const formTitle = document.getElementById("product-form-title");
const cancelEditButton = document.getElementById("cancel-edit");
const customCategoriesInput = document.getElementById("category-custom");
const saveProductButton = document.getElementById("save-product");
const productCountLabel = document.getElementById("product-count");
const publishedCountLabel = document.getElementById("published-count");
const editorModeLabel = document.getElementById("editor-mode");
const previewImage = document.getElementById("preview-image");
const previewName = document.getElementById("preview-name");
const previewCurrent = document.getElementById("preview-current");
const previewOriginal = document.getElementById("preview-original");
const previewBadge = document.getElementById("preview-badge");
const previewDescription = document.getElementById("preview-description");
const productImagesInput = document.getElementById("product-images");
const imageFilesInput = document.getElementById("product-image-files");
const uploadProductImagesButton = document.getElementById("upload-product-images");
const uploadStatus = document.getElementById("upload-status");
const sizeChartImageInput = document.getElementById("product-size-chart-image");
const sizeChartImageFileInput = document.getElementById("size-chart-image-file");
const uploadSizeChartImageButton = document.getElementById("upload-size-chart-image");
const sizeChartUploadStatus = document.getElementById("size-chart-upload-status");
const promoForm = document.getElementById("promo-form");
const promoList = document.getElementById("promo-list");
const promoAdminStatus = document.getElementById("promo-admin-status");
const orderList = document.getElementById("order-list");
const orderCountLabel = document.getElementById("order-count");
const unreadOrderLabel = document.getElementById("unread-order-count");

const SIGNATURE_ENDPOINT = "/.netlify/functions/cloudinary-signature";
const MAX_UPLOAD_SIZE_MB = 8;
const PRODUCT_UPLOAD_FOLDER = "accolade/products";
const SIZE_CHART_UPLOAD_FOLDER = "accolade/size-charts";

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseList(value, separatorRegex = /[\n,]+/) {
  return String(value || "")
    .split(separatorRegex)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value) {
  const parsed = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getTimestamp(value) {
  if (!value) {
    return 0;
  }
  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  return 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function setStatus(message, type = "normal") {
  if (!productStatus) {
    return;
  }
  productStatus.textContent = message;
  productStatus.classList.remove("is-error", "is-success");
  if (type === "error") {
    productStatus.classList.add("is-error");
  }
  if (type === "success") {
    productStatus.classList.add("is-success");
  }
}

function setUploadStatus(message, type = "normal") {
  if (!uploadStatus) {
    return;
  }
  uploadStatus.textContent = message;
  uploadStatus.classList.remove("is-error", "is-success");
  if (type === "error") {
    uploadStatus.classList.add("is-error");
  }
  if (type === "success") {
    uploadStatus.classList.add("is-success");
  }
}

function updateDashboardStats() {
  setText(productCountLabel, state.products.length);
  setText(
    publishedCountLabel,
    state.products.filter((product) => product.isPublished !== false).length,
  );
  setText(editorModeLabel, state.editingId ? "Edit" : "Add");
  setText(orderCountLabel, state.orders.length);
  setText(unreadOrderLabel, state.orders.filter((order) => order.isRead === false).length);
}

function getPreviewFields() {
  const name = document.getElementById("product-name")?.value.trim();
  const priceCurrent = toNumber(document.getElementById("price-current")?.value);
  const priceOriginalVal = document.getElementById("price-original")?.value.trim();
  const priceOriginal = priceOriginalVal ? toNumber(priceOriginalVal) : 0;
  const rawBadge = document.getElementById("product-badge")?.value.trim() || "";
  const badge = rawBadge.toLowerCase() === "featured" ? "" : rawBadge;
  const images = parseList(document.getElementById("product-images")?.value);
  const description = document.getElementById("product-description")?.value.trim() || "";

  return {
    name: name || "Product name",
    priceCurrent,
    priceOriginal: priceOriginal > priceCurrent ? priceOriginal : 0,
    badge: badge || "",
    primaryImage: images[0] || "photos/any.jpeg",
    description,
  };
}

function updatePreview() {
  if (!productForm) {
    return;
  }

  const preview = getPreviewFields();
  if (previewImage) {
    previewImage.src = preview.primaryImage;
    previewImage.alt = `${preview.name} preview`;
  }
  setText(previewName, preview.name);
  setText(previewCurrent, preview.priceCurrent || 0);
  if (previewOriginal) {
    if (preview.priceOriginal > preview.priceCurrent) {
      previewOriginal.textContent = preview.priceOriginal;
      previewOriginal.style.display = "inline";
    } else {
      previewOriginal.textContent = "";
      previewOriginal.style.display = "none";
    }
  }
  if (previewBadge) {
    if (preview.badge && preview.badge.toLowerCase() !== "featured") {
      previewBadge.textContent = preview.badge;
      previewBadge.style.display = "inline-flex";
    } else {
      previewBadge.textContent = "";
      previewBadge.style.display = "none";
    }
  }
  if (previewDescription) {
    previewDescription.textContent = preview.description || "Add product description (optional).";
  }
}

function resetForm(statusMessage = "Ready", statusType = "normal") {
  if (!productForm) {
    return;
  }
  productForm.reset();
  state.editingId = null;
  formTitle.textContent = "Add new product";
  cancelEditButton.classList.add("hidden-section");
  if (saveProductButton) {
    saveProductButton.textContent = "Save product";
  }
  updateDashboardStats();
  updatePreview();
  setStatus(statusMessage, statusType);
  setUploadStatus("No upload started");
  setSizeChartUploadStatus("No size chart image uploaded");
}

function setUploadButtonsDisabled(isDisabled) {
  if (uploadProductImagesButton) {
    uploadProductImagesButton.disabled = isDisabled;
  }
  if (uploadSizeChartImageButton) {
    uploadSizeChartImageButton.disabled = isDisabled;
  }
}

function setSizeChartUploadStatus(message, type = "normal") {
  if (!sizeChartUploadStatus) return;
  sizeChartUploadStatus.textContent = message;
  sizeChartUploadStatus.classList.remove("is-error", "is-success");
  if (type === "error") sizeChartUploadStatus.classList.add("is-error");
  if (type === "success") sizeChartUploadStatus.classList.add("is-success");
}

function validateFiles(files) {
  if (!files.length) {
    throw new Error("Please select at least one image file.");
  }

  files.forEach((file) => {
    if (!file.type.startsWith("image/")) {
      throw new Error(`"${file.name}" is not a valid image file.`);
    }
    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      throw new Error(
        `"${file.name}" is larger than ${MAX_UPLOAD_SIZE_MB}MB. Please compress it first.`,
      );
    }
  });
}

async function requestUploadSignature(folder) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Please sign in first.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(SIGNATURE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken, folder }),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    if (
      response.status === 404 &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ) {
      throw new Error(
        "Secure upload function is unavailable on a plain localhost server. Run the site with Netlify Dev or test on the deployed Netlify site.",
      );
    }
    throw new Error(payload.error || "Could not get upload signature.");
  }
  return payload;
}

async function uploadSingleFile(file, signatureData) {
  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", signatureData.apiKey);
  uploadForm.append("timestamp", String(signatureData.timestamp));
  uploadForm.append("signature", signatureData.signature);
  uploadForm.append("folder", signatureData.folder);

  const response = await fetch(signatureData.uploadUrl, {
    method: "POST",
    body: uploadForm,
  });
  const payload = await response.json();

  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || `Upload failed for "${file.name}".`);
  }

  return payload.secure_url;
}

function appendUrlsToProductImages(urls) {
  if (!productImagesInput || !urls.length) {
    return;
  }
  const existing = parseList(productImagesInput.value);
  const merged = [...existing, ...urls];
  productImagesInput.value = merged.join("\n");
  updatePreview();
}

async function handleUpload() {
  if (!imageFilesInput) {
    return;
  }

  try {
    const files = Array.from(imageFilesInput.files || []);
    validateFiles(files);
    setUploadButtonsDisabled(true);

    setUploadStatus("Getting secure upload token...");
    const signatureData = await requestUploadSignature(PRODUCT_UPLOAD_FOLDER);

    const uploadedUrls = [];
    for (let index = 0; index < files.length; index += 1) {
      setUploadStatus(`Uploading ${index + 1}/${files.length}: ${files[index].name}`);
      const url = await uploadSingleFile(files[index], signatureData);
      uploadedUrls.push(url);
    }

    appendUrlsToProductImages(uploadedUrls);
    setUploadStatus(
      `${uploadedUrls.length} image URL${
        uploadedUrls.length > 1 ? "s" : ""
      } added to product images.`,
      "success",
    );

    imageFilesInput.value = "";
  } catch (error) {
    console.error("Upload failed", error);
    setUploadStatus(error.message || "Upload failed.", "error");
  } finally {
    setUploadButtonsDisabled(false);
  }
}

async function handleSizeChartUpload() {
  if (!sizeChartImageFileInput || !sizeChartImageInput) return;
  try {
    const files = Array.from(sizeChartImageFileInput.files || []);
    validateFiles(files);
    if (files.length !== 1) throw new Error("Please choose one size chart image.");
    setUploadButtonsDisabled(true);
    setSizeChartUploadStatus("Uploading size chart...");
    const signatureData = await requestUploadSignature(SIZE_CHART_UPLOAD_FOLDER);
    sizeChartImageInput.value = await uploadSingleFile(files[0], signatureData);
    sizeChartImageFileInput.value = "";
    setSizeChartUploadStatus("Size chart image uploaded successfully.", "success");
  } catch (error) {
    console.error("Size chart upload failed", error);
    setSizeChartUploadStatus(error.message || "Size chart upload failed.", "error");
  } finally {
    setUploadButtonsDisabled(false);
  }
}

function getCategoriesFromForm() {
  const categories = new Set(["all"]);
  const featured = document.getElementById("category-featured").checked;
  const hotSelling = document.getElementById("category-hot").checked;
  if (featured) {
    categories.add("featured");
  }
  if (hotSelling) {
    categories.add("hot-selling");
  }
  parseList(customCategoriesInput.value).forEach((item) => {
    const slug = slugify(item);
    if (slug) {
      categories.add(slug);
    }
  });
  return {
    categories: Array.from(categories),
    featured,
    hotSelling,
  };
}

function getFormData() {
  const name = document.getElementById("product-name").value.trim();
  const priceCurrent = toNumber(document.getElementById("price-current").value);
  const priceOriginalVal = document.getElementById("price-original").value.trim();
  const priceOriginal = priceOriginalVal ? toNumber(priceOriginalVal) : 0;
  const rawBadge = document.getElementById("product-badge").value.trim();
  const badge = rawBadge.toLowerCase() === "featured" ? "" : rawBadge;
  const cotton = document.getElementById("product-cotton").value.trim();
  const rawSizes = (document.getElementById("product-sizes")?.value || "").trim();
  const sizes = parseList(rawSizes.replace(/,/g, "\n"));
  const rawColors = (document.getElementById("product-colors")?.value || "").trim();
  const colors = parseList(rawColors.replace(/,/g, "\n"));
  const sizeChartText = (document.getElementById("product-size-chart")?.value || "").trim();
  const sizeChartImage = (sizeChartImageInput?.value || "").trim();
  const imageUrls = parseList(document.getElementById("product-images").value);
  const description = (document.getElementById("product-description")?.value || "").trim();
  const sortOrder = Number.parseInt(
    document.getElementById("product-sort-order").value,
    10,
  );
  const isPublished = document.getElementById("product-published").checked;
  const { categories, featured, hotSelling } = getCategoriesFromForm();

  if (!name) {
    throw new Error("Product name is required.");
  }
  if (!imageUrls.length) {
    throw new Error("At least one image URL is required.");
  }
  if (!priceCurrent) {
    throw new Error("Current price is required.");
  }

  return {
    name,
    priceCurrent,
    priceOriginal: priceOriginal > priceCurrent ? priceOriginal : 0,
    badge: badge || "",
    cotton: cotton || "add details",
    sizes: sizes,
    colors: colors,
    sizeChartText: sizeChartText,
    sizeChartImage,
    images: imageUrls,
    description: description,
    categories,
    featured,
    hotSelling,
    isPublished,
    sortOrder: Number.isNaN(sortOrder) ? 9999 : sortOrder,
  };
}

function renderProductList() {
  if (!productList) {
    return;
  }
  updateDashboardStats();
  if (!state.products.length) {
    productList.innerHTML = `
      <p class="empty-note">No products found yet. Add the first product using the form.</p>
    `;
    return;
  }

  productList.innerHTML = state.products
    .map((product) => {
      const categories = product.categories?.join(", ") || "all";
      const visibility = product.isPublished === false ? "Draft" : "Published";
      return `
        <article class="product-row">
          <img src="${escapeHtml(product.images?.[0] || "photos/any.jpeg")}" alt="${escapeHtml(product.name)}" />
          <div class="product-row-info">
            <h3>${escapeHtml(product.name)}</h3>
            <p class="meta">BDT ${escapeHtml(product.priceCurrent)} | ${escapeHtml(categories)} | ${visibility}</p>
            <div class="product-row-actions">
              <button type="button" data-edit-id="${escapeHtml(product.id)}">Edit</button>
              <button type="button" data-delete-id="${escapeHtml(product.id)}" class="danger">Delete</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  productList.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = state.products.find(
        (product) => product.id === button.dataset.editId,
      );
      if (!selected) {
        return;
      }
      state.editingId = selected.id;
      formTitle.textContent = `Edit product: ${selected.name}`;
      cancelEditButton.classList.remove("hidden-section");
      if (saveProductButton) {
        saveProductButton.textContent = "Update product";
      }

      document.getElementById("product-name").value = selected.name || "";
      document.getElementById("price-current").value = selected.priceCurrent || "";
      document.getElementById("price-original").value = (selected.priceOriginal && selected.priceOriginal > selected.priceCurrent) ? selected.priceOriginal : "";
      document.getElementById("product-badge").value = selected.badge || "";
      document.getElementById("product-cotton").value = selected.cotton || "";
      const sizesField = document.getElementById("product-sizes");
      if (sizesField) {
        sizesField.value = Array.isArray(selected.sizes)
          ? selected.sizes.join(", ")
          : (selected.sizes || "");
      }
      const colorsField = document.getElementById("product-colors");
      if (colorsField) {
        colorsField.value = Array.isArray(selected.colors)
          ? selected.colors.join(", ")
          : (selected.colors || "");
      }
      const sizeChartField = document.getElementById("product-size-chart");
      if (sizeChartField) {
        sizeChartField.value = selected.sizeChartText || "";
      }
      if (sizeChartImageInput) {
        sizeChartImageInput.value = selected.sizeChartImage || "";
      }
      document.getElementById("product-images").value = (
        selected.images || []
      ).join("\n");
      const descField = document.getElementById("product-description");
      if (descField) {
        descField.value = selected.description || (Array.isArray(selected.designPoints) ? selected.designPoints.join("\n") : "");
      }
      document.getElementById("product-sort-order").value = selected.sortOrder ?? "";
      document.getElementById("product-published").checked =
        selected.isPublished !== false;
      document.getElementById("category-featured").checked =
        selected.featured === true || selected.categories?.includes("featured");
      document.getElementById("category-hot").checked =
        selected.hotSelling === true ||
        selected.categories?.includes("hot-selling");

      const custom = (selected.categories || []).filter(
        (item) => item !== "all" && item !== "featured" && item !== "hot-selling",
      );
      customCategoriesInput.value = custom.join(", ");

      updateDashboardStats();
      updatePreview();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setStatus("Editing existing product");
    });
  });

  productList.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const product = state.products.find(
        (item) => item.id === button.dataset.deleteId,
      );
      if (!product) {
        return;
      }
      const isConfirmed = window.confirm(
        `Delete "${product.name}"? This cannot be undone.`,
      );
      if (!isConfirmed) {
        return;
      }
      try {
        await deleteDoc(doc(db, PRODUCTS_COLLECTION, product.id));
        clearClientCaches();
        setStatus("Product deleted", "success");
        await loadProducts();
      } catch (error) {
        console.error("Delete failed", error);
        setStatus("Delete failed. Check Firestore permissions.", "error");
      }
    });
  });
}

function clearClientCaches() {
  try {
    localStorage.removeItem("accolade_products_v3");
    localStorage.removeItem("accolade_products_v2");
    localStorage.removeItem("accolade_products_cache");
    localStorage.removeItem("accolade_selected_product_v2");
    sessionStorage.clear();
  } catch (e) {}
}

async function loadProducts() {
  const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
  state.products = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        ...data,
        createdAtMs: getTimestamp(data.createdAt),
      };
    })
    .sort((left, right) => {
      const leftSort = Number.isFinite(Number(left.sortOrder))
        ? Number(left.sortOrder)
        : 9999;
      const rightSort = Number.isFinite(Number(right.sortOrder))
        ? Number(right.sortOrder)
        : 9999;
      if (leftSort !== rightSort) {
        return leftSort - rightSort;
      }
      return right.createdAtMs - left.createdAtMs;
    });
  renderProductList();
}

function setPromoStatus(message, type = "normal") {
  if (!promoAdminStatus) return;
  promoAdminStatus.textContent = message;
  promoAdminStatus.classList.remove("is-error", "is-success");
  if (type === "error") promoAdminStatus.classList.add("is-error");
  if (type === "success") promoAdminStatus.classList.add("is-success");
}

function renderPromoCodes() {
  if (!promoList) return;
  if (!state.promoCodes.length) {
    promoList.innerHTML = '<p class="empty-note">No promo codes yet.</p>';
    return;
  }
  promoList.innerHTML = state.promoCodes.map((promo) => `
    <div class="map-item">
      <strong>${escapeHtml(promo.code)}</strong>
      <span>${escapeHtml(promo.percent)}% off · ${promo.isActive === false ? "Inactive" : "Active"}</span>
      <div class="product-row-actions">
        <button type="button" data-promo-edit="${escapeHtml(promo.id)}">Edit</button>
        <button type="button" class="danger" data-promo-delete="${escapeHtml(promo.id)}">Delete</button>
      </div>
    </div>
  `).join("");

  promoList.querySelectorAll("[data-promo-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const promo = state.promoCodes.find((item) => item.id === button.dataset.promoEdit);
      if (!promo) return;
      document.getElementById("promo-admin-code").value = promo.code;
      document.getElementById("promo-admin-percent").value = promo.percent;
      document.getElementById("promo-admin-active").checked = promo.isActive !== false;
      state.promoEditingId = promo.id;
      setPromoStatus("Edit the values, then save.");
    });
  });

  promoList.querySelectorAll("[data-promo-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const promo = state.promoCodes.find((item) => item.id === button.dataset.promoDelete);
      if (!promo || !window.confirm(`Delete promo code "${promo.code}"?`)) return;
      try {
        await deleteDoc(doc(db, PROMO_CODES_COLLECTION, promo.id));
        await loadPromoCodes();
        setPromoStatus("Promo code deleted.", "success");
      } catch (error) {
        console.error("Promo delete failed", error);
        setPromoStatus("Could not delete promo code.", "error");
      }
    });
  });
}

async function loadPromoCodes() {
  const snapshot = await getDocs(collection(db, PROMO_CODES_COLLECTION));
  state.promoCodes = snapshot.docs
    .map((promoDoc) => ({ id: promoDoc.id, ...promoDoc.data() }))
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
  renderPromoCodes();
}

function formatOrderDate(value) {
  const timestamp = getTimestamp(value);
  return timestamp ? new Date(timestamp).toLocaleString("en-BD") : "Just received";
}

function renderOrders() {
  if (!orderList) return;
  updateDashboardStats();
  if (!state.orders.length) {
    orderList.innerHTML = '<p class="empty-note">No customer orders yet.</p>';
    return;
  }
  orderList.innerHTML = state.orders.map((order) => {
    const customer = order.customer || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const itemSummary = items.map((item) => `${escapeHtml(item.name)} × ${Number(item.quantity) || 1}${item.size ? ` · ${escapeHtml(item.size)}` : ""}${item.color ? ` · ${escapeHtml(item.color)}` : ""}`).join("<br>");
    return `<article class="product-row" style="grid-template-columns:minmax(0,1fr);${order.isRead === false ? 'border-color:rgba(223,183,108,.75);' : ''}">
      <div class="product-row-info">
        <h3>${escapeHtml(order.orderNumber || "Order")}${order.isRead === false ? ' <span class="pill" style="margin-left:6px;">New</span>' : ""}</h3>
        <p class="meta">${formatOrderDate(order.createdAt)} · ${escapeHtml(order.status || "New")}</p>
        <p><strong>${escapeHtml(customer.name || "Customer")}</strong><br>${escapeHtml(customer.phone || "")} · ${escapeHtml(customer.email || "")}<br>${escapeHtml(customer.address || "")}, ${escapeHtml(customer.city || "")}</p>
        <p>${itemSummary}</p>
        <p class="meta">Total: BDT ${escapeHtml(order.total || 0)}${order.promoCode && order.promoCode !== "None" ? ` · ${escapeHtml(order.promoCode)} (${escapeHtml(order.promoPercent || 0)}% off)` : ""}</p>
        <div class="product-row-actions">
          ${order.isRead === false ? `<button type="button" data-order-read="${escapeHtml(order.id)}">Mark read</button>` : ""}
          <button type="button" data-order-status="${escapeHtml(order.id)}">Mark confirmed</button>
        </div>
      </div>
    </article>`;
  }).join("");
  orderList.querySelectorAll("[data-order-read]").forEach((button) => button.addEventListener("click", async () => {
    await updateDoc(doc(db, ORDERS_COLLECTION, button.dataset.orderRead), { isRead: true });
    await loadOrders();
  }));
  orderList.querySelectorAll("[data-order-status]").forEach((button) => button.addEventListener("click", async () => {
    await updateDoc(doc(db, ORDERS_COLLECTION, button.dataset.orderStatus), { status: "Confirmed", isRead: true });
    await loadOrders();
  }));
}

async function loadOrders() {
  const snapshot = await getDocs(collection(db, ORDERS_COLLECTION));
  state.orders = snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() }))
    .sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt));
  renderOrders();
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;
    loginError.textContent = "";

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login failed", error);
      loginError.textContent =
        "Sign in failed. Check email/password and authorized domain.";
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await signOut(auth);
  });
}

if (cancelEditButton) {
  cancelEditButton.addEventListener("click", resetForm);
}

if (uploadProductImagesButton) {
  uploadProductImagesButton.addEventListener("click", () => {
    handleUpload();
  });
}

if (uploadSizeChartImageButton) {
  uploadSizeChartImageButton.addEventListener("click", handleSizeChartUpload);
}

if (promoForm) {
  promoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = document.getElementById("promo-admin-code").value.trim().toUpperCase();
    const percent = Number(document.getElementById("promo-admin-percent").value);
    const isActive = document.getElementById("promo-admin-active").checked;
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      setPromoStatus("Use letters, numbers, hyphens, or underscores only.", "error");
      return;
    }
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      setPromoStatus("Discount must be between 1% and 100%.", "error");
      return;
    }
    try {
      setPromoStatus("Saving promo code...");
      await setDoc(doc(db, PROMO_CODES_COLLECTION, code), {
        code,
        percent,
        isActive,
        updatedAt: serverTimestamp(),
      });
      if (state.promoEditingId && state.promoEditingId !== code) {
        await deleteDoc(doc(db, PROMO_CODES_COLLECTION, state.promoEditingId));
      }
      state.promoEditingId = null;
      promoForm.reset();
      document.getElementById("promo-admin-active").checked = true;
      await loadPromoCodes();
      setPromoStatus("Promo code saved successfully.", "success");
    } catch (error) {
      console.error("Promo save failed", error);
      setPromoStatus("Could not save promo code. Check Firestore permissions.", "error");
    }
  });
}

if (productForm) {
  productForm.addEventListener("input", updatePreview);
  productForm.addEventListener("change", updatePreview);
  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saveProductButton) {
      saveProductButton.disabled = true;
      saveProductButton.textContent = state.editingId ? "Updating..." : "Saving...";
    }
    setStatus(state.editingId ? "Updating product..." : "Saving product...");
    try {
      const payload = getFormData();
      if (state.editingId) {
        await updateDoc(doc(db, PRODUCTS_COLLECTION, state.editingId), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        clearClientCaches();
        await loadProducts();
        resetForm("Product updated successfully", "success");
      } else {
        await addDoc(collection(db, PRODUCTS_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        clearClientCaches();
        await loadProducts();
        resetForm("Product added successfully", "success");
      }
    } catch (error) {
      console.error("Save failed", error);
      setStatus(error.message || "Save failed", "error");
    } finally {
      if (saveProductButton) {
        saveProductButton.disabled = false;
        saveProductButton.textContent = state.editingId
          ? "Update product"
          : "Save product";
      }
    }
  });
  updatePreview();
}

onAuthStateChanged(auth, async (user) => {
  const isLoggedIn = Boolean(user);
  loginCard.classList.toggle("hidden-section", isLoggedIn);
  dashboardCard.classList.toggle("hidden-section", !isLoggedIn);

  if (isLoggedIn) {
    userEmailLabel.textContent = user.email || "Admin";
    setStatus("Ready");
    await loadProducts();
    try {
      await loadPromoCodes();
    } catch (error) {
      console.error("Could not load promo codes", error);
      setPromoStatus("Could not load promo codes. Check Firestore permissions.", "error");
    }
    try {
      await loadOrders();
    } catch (error) {
      console.error("Could not load orders", error);
    }
  } else {
    userEmailLabel.textContent = "";
    state.products = [];
    state.promoCodes = [];
    state.promoEditingId = null;
    state.orders = [];
    renderProductList();
    renderPromoCodes();
    resetForm();
  }
});
