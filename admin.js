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
  signInWithEmailAndPassword,
  signOut,
  updateDoc,
} from "./firebase-config.js";

const PRODUCTS_COLLECTION = "products";
const state = {
  editingId: null,
  products: [],
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
const previewSubtitle = document.getElementById("preview-subtitle");
const previewCurrent = document.getElementById("preview-current");
const previewOriginal = document.getElementById("preview-original");
const previewBadge = document.getElementById("preview-badge");
const previewChip = document.getElementById("preview-chip");
const previewDesignList = document.getElementById("preview-design-list");
const productImagesInput = document.getElementById("product-images");
const imageFilesInput = document.getElementById("product-image-files");
const uploadProductImagesButton = document.getElementById("upload-product-images");
const uploadStatus = document.getElementById("upload-status");

const SIGNATURE_ENDPOINT = "/.netlify/functions/cloudinary-signature";
const MAX_UPLOAD_SIZE_MB = 8;
const PRODUCT_UPLOAD_FOLDER = "accolade/products";

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
}

function getPreviewFields() {
  const name = document.getElementById("product-name")?.value.trim();
  const subtitle = document.getElementById("product-subtitle")?.value.trim();
  const priceCurrent = toNumber(document.getElementById("price-current")?.value);
  const priceOriginal = toNumber(
    document.getElementById("price-original")?.value || `${priceCurrent}`,
  );
  const badge = document.getElementById("product-badge")?.value.trim();
  const images = parseList(document.getElementById("product-images")?.value);
  const designPoints = parseList(document.getElementById("product-design")?.value);
  const isFeatured = document.getElementById("category-featured")?.checked;
  const isHot = document.getElementById("category-hot")?.checked;

  return {
    name: name || "Product name",
    subtitle: subtitle || "Premium collection",
    priceCurrent,
    priceOriginal: priceOriginal || priceCurrent,
    badge: badge || "NEW",
    primaryImage: images[0] || "photos/any.jpeg",
    designPoints: designPoints.slice(0, 3),
    chip: isFeatured ? "Featured" : isHot ? "Hot Selling" : "Product",
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
  setText(previewSubtitle, preview.subtitle);
  setText(previewCurrent, preview.priceCurrent || 0);
  setText(previewOriginal, preview.priceOriginal || preview.priceCurrent || 0);
  setText(previewBadge, preview.badge);
  setText(previewChip, preview.chip);

  if (previewDesignList) {
    const items = preview.designPoints.length
      ? preview.designPoints
      : ["Add up to three product highlights."];
    previewDesignList.innerHTML = items
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
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
}

function setUploadButtonsDisabled(isDisabled) {
  if (uploadProductImagesButton) {
    uploadProductImagesButton.disabled = isDisabled;
  }
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
  const subtitle = document.getElementById("product-subtitle").value.trim();
  const priceCurrent = toNumber(document.getElementById("price-current").value);
  const priceOriginal = toNumber(
    document.getElementById("price-original").value || `${priceCurrent}`,
  );
  const badge = document.getElementById("product-badge").value.trim();
  const cotton = document.getElementById("product-cotton").value.trim();
  const quality = document.getElementById("product-quality").value.trim();
  const fabric = document.getElementById("product-fabric").value.trim();
  const rawColors = (document.getElementById("product-colors")?.value || "").trim();
  const colors = parseList(rawColors.replace(/,/g, "\n"));
  const imageUrls = parseList(document.getElementById("product-images").value);
  const designPoints = parseList(document.getElementById("product-design").value);
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
    subtitle: subtitle || "Premium collection",
    priceCurrent,
    priceOriginal: priceOriginal || priceCurrent,
    badge: badge || "NEW",
    cotton: cotton || "add details",
    quality: quality || "add details",
    fabric: fabric || "add details",
    colors: colors,
    images: imageUrls,
    designPoints: designPoints.slice(0, 3),
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
            <p>${escapeHtml(product.subtitle)}</p>
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
      document.getElementById("product-subtitle").value = selected.subtitle || "";
      document.getElementById("price-current").value = selected.priceCurrent || "";
      document.getElementById("price-original").value = selected.priceOriginal || "";
      document.getElementById("product-badge").value = selected.badge || "";
      document.getElementById("product-cotton").value = selected.cotton || "";
      document.getElementById("product-quality").value = selected.quality || "";
      document.getElementById("product-fabric").value = selected.fabric || "";
      const colorsField = document.getElementById("product-colors");
      if (colorsField) {
        colorsField.value = Array.isArray(selected.colors)
          ? selected.colors.join(", ")
          : (selected.colors || "");
      }
      document.getElementById("product-images").value = (
        selected.images || []
      ).join("\n");
      document.getElementById("product-design").value = (
        selected.designPoints || []
      ).join("\n");
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
        try {
          localStorage.removeItem("accolade_products_cache");
        } catch (e) {}
        setStatus("Product deleted", "success");
        await loadProducts();
      } catch (error) {
        console.error("Delete failed", error);
        setStatus("Delete failed. Check Firestore permissions.", "error");
      }
    });
  });
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
        try {
          localStorage.removeItem("accolade_products_cache");
        } catch (e) {}
        await loadProducts();
        resetForm("Product updated successfully", "success");
      } else {
        await addDoc(collection(db, PRODUCTS_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        try {
          localStorage.removeItem("accolade_products_cache");
        } catch (e) {}
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
  } else {
    userEmailLabel.textContent = "";
    state.products = [];
    renderProductList();
    resetForm();
  }
});
