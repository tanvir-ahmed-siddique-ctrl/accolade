import { addDoc, collection, db, serverTimestamp } from "./storefront-firebase.js";

const ORDERS_COLLECTION = "orders";

function orderNumber() {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ACC-${stamp}-${random}`;
}

function text(value) {
  return String(value || "").trim();
}

window.submitAccoladeOrder = async function submitAccoladeOrder(order) {
  const payload = {
    orderNumber: orderNumber(),
    customer: {
      name: text(order.customer?.name),
      email: text(order.customer?.email),
      phone: text(order.customer?.phone),
      city: text(order.customer?.city),
      address: text(order.customer?.address),
    },
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: Number(order.subtotal) || 0,
    discount: Number(order.discount) || 0,
    deliveryFee: Number(order.deliveryFee) || 0,
    total: Number(order.total) || 0,
    promoCode: text(order.promoCode) || "None",
    promoPercent: Number(order.promoPercent) || 0,
    paymentLast4: text(order.paymentLast4),
    status: "New",
    isRead: false,
    createdAt: serverTimestamp(),
  };

  let saved;
  try {
    saved = await addDoc(collection(db, ORDERS_COLLECTION), payload);
  } catch (error) {
    console.error("Firestore order save failed", error);
    if (error?.code === "permission-denied") {
      throw new Error("ORDER_PERMISSION_DENIED");
    }
    throw new Error(`ORDER_SAVE_FAILED: ${error?.message || "Unknown error"}`);
  }

  let emailSent = false;
  try {
    const response = await fetch("/.netlify/functions/send-order-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Email delivery failed");
    emailSent = true;
  } catch (error) {
    console.warn("Order saved, but email delivery is not configured yet.", error);
  }

  return { id: saved.id, orderNumber: payload.orderNumber, emailSent };
};

window.dispatchEvent(new Event("accolade:order-system-ready"));
