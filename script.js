/* =========================
   L’Oréal Routine Builder - script.js
   ========================= */

/* ====== CONFIG ====== */
const WORKER_URL = "https://shiny-moon-5e30.dsofiagomezo.workers.dev/"; // tu Worker
const SYSTEM_PROMPT_ROUTINE = `
You are "L’Oréal Routine Builder"—an assistant that builds personalized beauty
routines using ONLY the selected L’Oréal-family products provided in the input
(JSON list with name, brand, category, and description).
Focus on skincare, haircare, makeup, suncare, and fragrance.

Rules:
- Recommend steps in order (AM/PM if skincare; wash/condition/treat/style if haircare).
- Use only the provided products; do not invent products.
- Be concise, friendly, and actionable. No medical claims.
- Ask clarifying questions if info is missing (skin/hair type, concerns, budget).
- If asked about unrelated topics, politely refuse and steer back to L’Oréal beauty topics.
`;

/* ====== DOM ====== */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsBox = document.getElementById("selectedProductsList");
const genBtn = document.getElementById("generateRoutine");

const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

/* ====== STATE ====== */
let allProducts = [];
let selected = loadSelected(); // desde localStorage
const messages = [{ role: "system", content: SYSTEM_PROMPT_ROUTINE }];

/* ====== Init ====== */
init();

async function init() {
  // Mensaje de bienvenida
  addMessage(
    "👋 Pick products, then click <strong>Generate Routine</strong>. Ask follow-ups any time.",
    "bot"
  );

  // Placeholder inicial
  if (productsContainer) {
    productsContainer.innerHTML = `<div class="placeholder-message">Select a category to view products</div>`;
  }

  // Carga de productos
  allProducts = await loadProducts();

  // Eventos
  if (categoryFilter) categoryFilter.addEventListener("change", renderProducts);
  if (genBtn) genBtn.addEventListener("click", onGenerateRoutine);
  if (chatForm) chatForm.addEventListener("submit", onSendMessage);

  // Render inicial (si ya había seleccionados)
  renderProducts();
  renderSelected();
}

/* ====== Data ====== */
async function loadProducts() {
  const res = await fetch("products.json");
  const data = await res.json();
  return Array.isArray(data) ? data : data.products || [];
}

/* ====== Render ====== */
function renderProducts() {
  if (!productsContainer) return;

  const cat = categoryFilter?.value || "";
  const list = cat ? allProducts.filter((p) => p.category === cat) : [];

  // Replace the product card template so each card includes:
  // - a Details button (.desc-toggle) with aria attributes
  // - a hidden description element (.product-desc) that can be toggled
  productsContainer.innerHTML = list
    .map((p) => {
      const isSel = selected.some((s) => s.id === p.id);
      return `
      <div class="product-card ${isSel ? "selected" : ""}" data-id="${esc(
        p.id
      )}" aria-expanded="false">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" />
        <div class="product-info">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.brand)}</p>
          <span class="pill">${esc(p.category || "")}</span>

          <button class="desc-toggle" aria-expanded="false" aria-controls="desc-${esc(
            p.id
          )}">
            Details
          </button>

          <div id="desc-${esc(p.id)}" class="product-desc">
            ${esc(p.description || "No description available.")}
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  // Toggle selección
  productsContainer.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (ev) => {
      // If the click originated from the Details button, don't toggle selection
      if (ev.target.closest(".desc-toggle")) return;

      const id = card.getAttribute("data-id");
      const prod = allProducts.find((x) => String(x.id) === String(id));
      if (!prod) return;
      toggleSelect(prod);
      card.classList.toggle("selected");
      renderSelected();
    });
  });

  // Delegated listener: open/close description when Details is clicked
  productsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".desc-toggle");
    if (!btn) return;
    const card = btn.closest(".product-card");
    if (!card) return;
    const expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!expanded));
    card.setAttribute("aria-expanded", String(!expanded));
    btn.textContent = expanded ? "Details" : "Hide details";
  });

  if (!cat) {
    productsContainer.innerHTML = `<div class="placeholder-message">Select a category to view products</div>`;
  }
}

function renderSelected() {
  if (!selectedProductsBox) return;

  if (selected.length === 0) {
    selectedProductsBox.innerHTML = `<div class="placeholder-small">No products selected yet.</div>`;
    return;
  }

  selectedProductsBox.innerHTML = selected
    .map(
      (p) => `
    <div class="selected-item" data-id="${esc(p.id)}">
      <img src="${esc(p.image)}" alt="${esc(p.name)}" />
      <div class="meta">
        <div class="brand">${esc(p.brand)}</div>
        <div class="name">${esc(p.name)}</div>
      </div>
      <button class="remove-btn" aria-label="Remove">Remove</button>
    </div>
  `
    )
    .join("");

  selectedProductsBox.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const card = e.currentTarget.closest(".selected-item");
      const id = card?.getAttribute("data-id");
      selected = selected.filter((x) => String(x.id) !== String(id));
      saveSelected(selected);
      renderProducts();
      renderSelected();
    });
  });
}

/* ====== Selección ====== */
function toggleSelect(prod) {
  const exists = selected.some((p) => p.id === prod.id);
  if (exists) {
    selected = selected.filter((p) => p.id !== prod.id);
  } else {
    selected.push(prod);
  }
  saveSelected(selected);
}
function saveSelected(list) {
  localStorage.setItem("loreal_selected_v1", JSON.stringify(list));
}
function loadSelected() {
  try {
    return JSON.parse(localStorage.getItem("loreal_selected_v1")) || [];
  } catch {
    return [];
  }
}

/* ====== Generate Routine ====== */
async function onGenerateRoutine() {
  if (selected.length === 0) {
    addMessage(
      "Please select at least one product to build your routine.",
      "bot"
    );
    return;
  }

  const minimal = selected.map(
    ({ id, name, brand, category, description }) => ({
      id,
      name,
      brand,
      category,
      description,
    })
  );

  const userMsg = `Build a personalized routine using ONLY these products:\n${JSON.stringify(
    minimal
  )}`;
  messages.push({ role: "user", content: userMsg });

  addMessage("🧪 Generating your routine…", "bot");

  const reply = await callAI(messages);
  addMessage(reply, "bot");
  messages.push({ role: "assistant", content: reply });
}

/* ====== Chat Follow-up ====== */
async function onSendMessage(e) {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  userInput.value = "";

  // Contexto breve: seleccionados actuales (solo id, name, brand, category)
  const contextNote = selected.length
    ? `Context: selected products = ${JSON.stringify(
        selected.map(({ id, name, brand, category }) => ({
          id,
          name,
          brand,
          category,
        }))
      )}`
    : `Context: no selected products yet.`;

  const turn = [
    { role: "system", content: SYSTEM_PROMPT_ROUTINE },
    { role: "system", content: contextNote },
    ...messages.filter((m) => m.role !== "system"),
    { role: "user", content: text },
  ];

  const reply = await callAI(turn);
  addMessage(reply, "bot");

  messages.push({ role: "user", content: text });
  messages.push({ role: "assistant", content: reply });
}

/* ====== Worker Call ====== */
async function callAI(msgs) {
  try {
    const r = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs }),
    });
    const raw = await r.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return `⚠️ Worker returned non-JSON: ${raw}`;
    }
    return (
      data.reply ??
      data.choices?.[0]?.message?.content ??
      "Sorry—no response was returned."
    );
  } catch (err) {
    return `⚠️ Error: ${err.message}`;
  }
}

/* ====== Chat UI helpers ====== */
function addMessage(text, who = "bot") {
  if (!chatWindow) return;
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.innerHTML = sanitize(text).replace(/\n/g, "<br>");
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
function sanitize(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;strong&gt;/g, "<strong>")
    .replace(/&lt;\/strong&gt;/g, "</strong>");
}
function esc(s) {
  return sanitize(s);
}
