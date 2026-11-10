// =========================================================
// 제주상회 장바구니
// 화면은 cart_id 하나만 기억하고, 담기·수량·삭제·주문은 전부
// FastAPI(Railway) 에 요청 → FastAPI 가 Supabase 에 저장한다.
// =========================================================
const API = window.API_BASE;
const $ = (id) => document.getElementById(id);
const won = (n) => n.toLocaleString("ko-KR") + "원";

const PALETTE = {
  과일: "linear-gradient(135deg,#ffe3c2,#ffc583)",
  간식: "linear-gradient(135deg,#fde2e4,#f9c6cf)",
  정육: "linear-gradient(135deg,#ffe0d6,#f7b8a3)",
  음료: "linear-gradient(135deg,#e1f3e3,#bfe6c5)",
  기념품: "linear-gradient(135deg,#dff0f6,#b9dfee)",
};
const bgOf = (cat) => PALETTE[cat] || "linear-gradient(135deg,#eee,#ddd)";

/* ---------- cart_id: 브라우저마다 하나 ---------- */
function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function getCartId() {
  try {
    let id = localStorage.getItem("jeju_cart_id");
    if (!id) { id = newId(); localStorage.setItem("jeju_cart_id", id); }
    return id;
  } catch {
    window.__cartId = window.__cartId || newId();
    return window.__cartId;
  }
}
const CART_ID = getCartId();

/* ---------- API 호출 ---------- */
async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body && body.detail ? (typeof body.detail === "string" ? body.detail : "요청 형식 오류") : res.status + " 오류";
    throw new Error(msg);
  }
  return body;
}

/* ---------- 상태 ---------- */
let products = [];
let cart = { items: [], count: 0, item_total: 0, shipping: 0, total: 0, free_shipping_from: 50000 };
let category = "전체";
let busy = false;

/* ---------- 토스트 ---------- */
let toastTimer;
function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("error", isError);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- 상품 목록 ---------- */
function renderFilters() {
  const cats = ["전체", ...new Set(products.map((p) => p.category).filter(Boolean))];
  $("filters").innerHTML = "";
  cats.forEach((c) => {
    const b = document.createElement("button");
    b.textContent = c;
    b.className = c === category ? "on" : "";
    b.onclick = () => { category = c; renderFilters(); renderProducts(); };
    $("filters").appendChild(b);
  });
}

function renderProducts() {
  const grid = $("grid");
  grid.innerHTML = "";
  const inCart = new Map(cart.items.map((i) => [i.product.id, i.quantity]));
  products
    .filter((p) => category === "전체" || p.category === category)
    .forEach((p) => {
      const card = document.createElement("article");
      card.className = "card";

      const thumb = document.createElement("div");
      thumb.className = "thumb";
      thumb.style.background = bgOf(p.category);
      thumb.textContent = p.emoji || "🎁";
      const cat = document.createElement("span");
      cat.className = "cat";
      cat.textContent = p.category || "";
      thumb.appendChild(cat);

      const body = document.createElement("div");
      body.className = "card-body";
      const h3 = document.createElement("h3"); h3.textContent = p.name;
      const desc = document.createElement("p"); desc.textContent = p.description || "";
      const price = document.createElement("div"); price.className = "price"; price.textContent = won(p.price);

      const btn = document.createElement("button");
      const q = inCart.get(p.id);
      btn.className = "add" + (q ? " in-cart" : "");
      btn.textContent = q ? `✓ 담김 (${q}개) · 하나 더` : "장바구니 담기";
      btn.onclick = () => addToCart(p, btn);

      body.append(h3, desc, price, btn);
      card.append(thumb, body);
      grid.appendChild(card);
    });
}

/* ---------- 장바구니 ---------- */
function setCart(next) {
  const prevCount = cart.count;
  cart = next;
  const badge = $("cartBadge");
  badge.textContent = cart.count;
  if (cart.count !== prevCount) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
  renderCart();
  renderProducts();
}

function renderCart() {
  $("drawerCount").textContent = cart.count ? `${cart.count}개` : "";
  $("sumItems").textContent = won(cart.item_total);
  $("sumShip").textContent = cart.item_total === 0 ? "0원" : cart.shipping === 0 ? "무료 🎉" : won(cart.shipping);
  $("sumTotal").textContent = won(cart.total);
  $("checkoutBtn").disabled = cart.items.length === 0;
  $("clearBtn").style.display = cart.items.length ? "" : "none";

  // 무료 배송 게이지
  const goal = cart.free_shipping_from;
  const left = Math.max(0, goal - cart.item_total);
  $("shipBar").style.width = Math.min(100, (cart.item_total / goal) * 100) + "%";
  $("shipMeter").classList.toggle("done", left === 0 && cart.item_total > 0);
  $("shipText").innerHTML = cart.item_total === 0
    ? `<b>${won(goal)}</b> 이상 담으면 무료 배송!`
    : left === 0 ? "🎉 <b>무료 배송</b> 조건을 채웠어요!" : `<b>${won(left)}</b> 더 담으면 무료 배송!`;

  const list = $("cartList");
  list.innerHTML = "";
  if (!cart.items.length) {
    list.innerHTML = '<li class="empty"><span class="big">🧺</span>장바구니가 비어 있어요.<br>제주의 맛을 담아 보세요!</li>';
    return;
  }
  cart.items.forEach((item) => {
    const p = item.product;
    const li = document.createElement("li");
    li.className = "cart-item";

    const th = document.createElement("div");
    th.className = "ci-thumb"; th.style.background = bgOf(p.category); th.textContent = p.emoji || "🎁";

    const mid = document.createElement("div");
    const name = document.createElement("div"); name.className = "ci-name"; name.textContent = p.name;
    const price = document.createElement("div"); price.className = "ci-price"; price.textContent = won(p.price);
    const qty = document.createElement("div"); qty.className = "qty";
    const minus = document.createElement("button"); minus.textContent = "−"; minus.setAttribute("aria-label", "수량 줄이기");
    const num = document.createElement("span"); num.textContent = item.quantity;
    const plus = document.createElement("button"); plus.textContent = "+"; plus.setAttribute("aria-label", "수량 늘리기");
    minus.onclick = () => item.quantity > 1 ? changeQty(item, item.quantity - 1) : removeItem(item);
    plus.onclick = () => item.quantity < 99 && changeQty(item, item.quantity + 1);
    qty.append(minus, num, plus);
    mid.append(name, price, qty);

    const right = document.createElement("div"); right.className = "ci-right";
    const sub = document.createElement("div"); sub.className = "ci-sub"; sub.textContent = won(item.subtotal);
    const rm = document.createElement("button"); rm.className = "remove"; rm.textContent = "삭제";
    rm.onclick = () => removeItem(item);
    right.append(sub, rm);

    li.append(th, mid, right);
    list.appendChild(li);
  });
}

async function run(task, okMsg) {
  if (busy) return;
  busy = true;
  try {
    const next = await task();
    if (next) setCart(next);
    if (okMsg) toast(okMsg);
  } catch (e) {
    toast("⚠️ " + e.message, true);
  } finally {
    busy = false;
  }
}

async function addToCart(p, btn) {
  btn.disabled = true;
  await run(() => api(`/cart/${CART_ID}/items`, { method: "POST", body: JSON.stringify({ product_id: p.id, quantity: 1 }) }),
    `${p.emoji || ""} ${p.name}을(를) 담았어요`);
  btn.disabled = false;
}
const changeQty = (item, q) =>
  run(() => api(`/cart/${CART_ID}/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ quantity: q }) }));
const removeItem = (item) =>
  run(() => api(`/cart/${CART_ID}/items/${item.id}`, { method: "DELETE" }), `${item.product.name}을(를) 뺐어요`);

$("clearBtn").onclick = () => {
  if (confirm("장바구니를 모두 비울까요?")) run(() => api(`/cart/${CART_ID}`, { method: "DELETE" }), "장바구니를 비웠어요");
};

$("checkoutBtn").onclick = async () => {
  if (busy || !cart.items.length) return;
  busy = true;
  $("checkoutBtn").disabled = true;
  try {
    const order = await api(`/cart/${CART_ID}/checkout`, { method: "POST" });
    $("orderText").textContent = `주문번호 #${order.id} · 총 ${won(order.total)}`;
    const ul = $("orderItems");
    ul.innerHTML = "";
    order.items.forEach((i) => {
      const li = document.createElement("li");
      const a = document.createElement("span"); a.textContent = `${i.name} × ${i.quantity}`;
      const b = document.createElement("span"); b.textContent = won(i.price * i.quantity);
      li.append(a, b); ul.appendChild(li);
    });
    const ship = document.createElement("li");
    ship.innerHTML = `<span>배송비</span><span>${order.shipping ? won(order.shipping) : "무료"}</span>`;
    ul.appendChild(ship);
    closeDrawer();
    $("modal").classList.add("show");
    $("modal").setAttribute("aria-hidden", "false");
    busy = false;
    await loadCart();
  } catch (e) {
    toast("⚠️ " + e.message, true);
    busy = false;
    renderCart();
  }
};

/* ---------- 서랍·모달 열고 닫기 ---------- */
function openDrawer() { $("drawer").classList.add("show"); $("overlay").classList.add("show"); $("drawer").setAttribute("aria-hidden", "false"); }
function closeDrawer() { $("drawer").classList.remove("show"); $("overlay").classList.remove("show"); $("drawer").setAttribute("aria-hidden", "true"); }
$("openCart").onclick = openDrawer;
$("closeCart").onclick = closeDrawer;
$("overlay").onclick = closeDrawer;
$("modalClose").onclick = () => { $("modal").classList.remove("show"); $("modal").setAttribute("aria-hidden", "true"); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); $("modalClose").click(); } });

/* ---------- 시작 ---------- */
async function loadCart() { setCart(await api(`/cart/${CART_ID}`)); }

async function init() {
  $("apiUrl").textContent = "API: " + API;
  $("grid").innerHTML = '<div class="skeleton"></div>'.repeat(4);
  try {
    products = await api("/products");
    renderFilters();
    await loadCart();
    $("statusLine").textContent = "";
  } catch (e) {
    $("grid").innerHTML = "";
    $("statusLine").textContent = "⚠️ 서버에 연결하지 못했어요: " + e.message + " (API: " + API + ")";
  }
}
init();
