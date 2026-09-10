const RESEND_API_URL = "https://api.resend.com/emails";

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  return `${Number(value || 0).toLocaleString("en-BD")} Tk`;
}

async function send(apiKey, message) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!response.ok) throw new Error(await response.text());
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const adminEmail = process.env.SELLER_NOTIFICATION_EMAIL;
  if (!apiKey || !from || !adminEmail) return json(503, { error: "Order email is not configured" });

  let order;
  try { order = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid order" }); }
  if (!order?.orderNumber || !order?.customer?.email || !Array.isArray(order.items) || !order.items.length) {
    return json(400, { error: "Incomplete order" });
  }

  const customer = order.customer;
  const itemRows = order.items.map((item) => `
    <tr><td style="padding:10px 0;border-bottom:1px solid #eee">${escapeHtml(item.name)}${item.size ? ` · Size ${escapeHtml(item.size)}` : ""}${item.color ? ` · ${escapeHtml(item.color)}` : ""} × ${Number(item.quantity) || 1}</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right">${money(item.price)}</td></tr>`).join("");
  const totals = `<table style="width:100%;font-size:14px"><tr><td>Subtotal</td><td style="text-align:right">${money(order.subtotal)}</td></tr>${order.discount ? `<tr><td>Promo (${escapeHtml(order.promoCode)} ${Number(order.promoPercent) || 0}%)</td><td style="text-align:right">−${money(order.discount)}</td></tr>` : ""}<tr><td>Delivery</td><td style="text-align:right">${money(order.deliveryFee)}</td></tr><tr><td style="padding-top:12px;font-weight:700">Total</td><td style="padding-top:12px;text-align:right;font-weight:700">${money(order.total)}</td></tr></table>`;
  const shell = (content) => `<div style="max-width:620px;margin:auto;padding:28px;font-family:Arial,sans-serif;color:#1f1f1f;background:#fff"><div style="padding-bottom:18px;border-bottom:2px solid #1f1f1f"><strong style="font-size:22px;letter-spacing:3px">ACCOLADE</strong><br><span style="font-size:12px;color:#766">WEAR YOUR ACCOLADE</span></div>${content}<p style="margin-top:28px;font-size:12px;color:#777">Accolade · Bangladesh</p></div>`;

  const customerHtml = shell(`<h1 style="font-size:22px">Thanks for your order, ${escapeHtml(customer.name)}.</h1><p>We received your order and will contact you shortly to confirm it.</p><p style="font-size:13px"><strong>Order number:</strong> ${escapeHtml(order.orderNumber)}</p><table style="width:100%;border-collapse:collapse;margin-top:18px">${itemRows}</table><div style="margin-top:18px;padding:16px;background:#f7f4ef">${totals}</div><p style="margin-top:20px;font-size:13px">Delivery address: ${escapeHtml(customer.address)}, ${escapeHtml(customer.city)}</p>`);
  const adminHtml = shell(`<h1 style="font-size:22px">New order · ${escapeHtml(order.orderNumber)}</h1><p><strong>${escapeHtml(customer.name)}</strong><br>${escapeHtml(customer.phone)} · ${escapeHtml(customer.email)}<br>${escapeHtml(customer.address)}, ${escapeHtml(customer.city)}</p><table style="width:100%;border-collapse:collapse;margin-top:18px">${itemRows}</table><div style="margin-top:18px;padding:16px;background:#f7f4ef">${totals}</div><p style="font-size:13px">Payment last 4: ${escapeHtml(order.paymentLast4 || "Not supplied")}</p>`);
  try {
    await Promise.all([
      send(apiKey, { from, to: [adminEmail], subject: `New order ${order.orderNumber} · ${money(order.total)}`, html: adminHtml }),
      send(apiKey, { from, to: [customer.email], subject: `Your Accolade order ${order.orderNumber}`, html: customerHtml }),
    ]);
    return json(200, { ok: true });
  } catch (error) {
    console.error("Order email failed", error);
    return json(502, { error: "Could not send order email" });
  }
};
