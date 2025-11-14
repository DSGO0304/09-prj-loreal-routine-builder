// ========= CONFIG =========
const WORKER_URL = "https://shiny-moon-5e30.dsofiagomezo.workers.dev/";

// Prompt del asistente (solo temas L'Oréal / belleza)
const SYSTEM_PROMPT = `
You are "L’Oréal Beauty Chat"—an expert assistant focused ONLY on L’Oréal
products, routines, and beauty recommendations (skincare, haircare, makeup,
suncare, fragrance). If the user asks unrelated questions, politely refuse and
explain you can only help with beauty-related topics for L’Oréal.

Use the selected products (if any) as the base for personalized routines.
`;

// ========= DOM: PRODUCTOS =========
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectedBtn = document.getElementById("clearSelected");

// ========= DOM: CHAT =========
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const lastQEl = document.getElementById("lastQuestion");

// ========= DOM: TOGGLES (EXTRA) =========
const rtlToggle = document.getElementById("rtlToggle");
const webModeToggle = document.getElementById("webMode");

// ========= STATE =========
let allProducts = [];
let selectedProducts = [];
const messages = [{ role: "system", content: SYSTEM_PROMPT }];

// ========= PRODUCTOS =========

// Placeholder inicial
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

// Cargar productos desde products.json
async function loadProducts() {
  if (allProducts.length) return allProducts;
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  return allProducts;
}

// Función que aplica Filtro de categoría + búsqueda por texto
function getFilteredProducts() {
  const category = categoryFilter.value;
  const query = productSearch.value.trim().toLowerCase();

  return allProducts.filter((product) => {
    const matchCategory = category ? product.category === category : true;

    const hayTexto = query.length > 0;
    const matchText = !hayTexto
      ? true
      : (
          product.name.toLowerCase().includes(query) ||
          product.brand.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query)
        );

    return matchCategory && matchText;
  });
}

// Renderizar cards
function displayProducts(products) {
  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your filters yet.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
      <div class="product-card ${
        selectedProducts.some((p) => p.id === product.id) ? "selected" : ""
      }" data-id="${product.id}">
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p class="brand">${product.brand}</p>
          <button class="description-btn" data-id="${product.id}">
            View description
          </button>
          <button class="select-btn" data-id="${product.id}">
            ${
              selectedProducts.some((p) => p.id === product.id)
                ? "✓ In routine"
                : "+ Add to routine"
            }
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

// Filtro por categoría
categoryFilter.addEventListener("change", async () => {
  await loadProducts();
  const filtered = getFilteredProducts();
  displayProducts(filtered);
});

// Búsqueda por texto (Product Search LevelUp)
productSearch.addEventListener("input", async () => {
  await loadProducts();
  const filtered = getFilteredProducts();
  displayProducts(filtered);
});

// Clicks dentro del grid: descripción + toggle selección
productsContainer.addEventListener("click", (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  const product = allProducts.find((p) => String(p.id) === String(id));
  if (!product) return;

  // Ver descripción
  if (e.target.classList.contains("description-btn")) {
    alert(`${product.name}\n\n${product.description}`);
    return;
  }

  // Toggle selección
  if (e.target.classList.contains("select-btn")) {
    const alreadySelected = selectedProducts.some(
      (p) => String(p.id) === String(product.id)
    );

    const card = e.target.closest(".product-card");

    if (alreadySelected) {
      // Quitar de la lista
      selectedProducts = selectedProducts.filter(
        (p) => String(p.id) !== String(product.id)
      );
      // Actualizar UI en card
      if (card) {
        card.classList.remove("selected");
        e.target.textContent = "+ Add to routine";
      }
    } else {
      // Agregar a la lista
      selectedProducts.push(product);
      // Actualizar UI en card
      if (card) {
        card.classList.add("selected");
        e.target.textContent = "✓ In routine";
      }
    }

    renderSelectedProducts();
    saveSelectedProducts();
  }
});

// Mostrar productos seleccionados
function renderSelectedProducts() {
  if (!selectedProducts.length) {
    selectedProductsList.innerHTML =
      `<p class="placeholder-message">No products selected yet.</p>`;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (p) => `
      <div class="selected-item">
        <div>
          <div class="name">${p.name}</div>
          <div class="brand">${p.brand}</div>
        </div>
        <button class="remove-btn" data-id="${p.id}">Remove</button>
      </div>
    `
    )
    .join("");
}

// Eliminar uno desde la lista
selectedProductsList.addEventListener("click", (e) => {
  if (!e.target.classList.contains("remove-btn")) return;

  const id = e.target.dataset.id;
  selectedProducts = selectedProducts.filter((p) => String(p.id) !== String(id));

  // Volver a dibujar lista
  renderSelectedProducts();
  saveSelectedProducts();

  // También actualizar las cards visibles (quitar estado "selected")
  const cards = productsContainer.querySelectorAll(".product-card");
  cards.forEach((card) => {
    const cardId = card.getAttribute("data-id");
    const btn = card.querySelector(".select-btn");
    if (String(cardId) === String(id)) {
      card.classList.remove("selected");
      if (btn) btn.textContent = "+ Add to routine";
    }
  });
});

// "Clear All" para vaciar todo
if (clearSelectedBtn) {
  clearSelectedBtn.addEventListener("click", () => {
    selectedProducts = [];
    renderSelectedProducts();
    saveSelectedProducts();

    // Quitar estado selected en las cards
    const cards = productsContainer.querySelectorAll(".product-card");
    cards.forEach((card) => {
      card.classList.remove("selected");
      const btn = card.querySelector(".select-btn");
      if (btn) btn.textContent = "+ Add to routine";
    });
  });
}

// Guardar en localStorage
function saveSelectedProducts() {
  localStorage.setItem(
    "lorealSelectedProducts",
    JSON.stringify(selectedProducts)
  );
}

// Cargar desde localStorage al inicio
function loadSelectedProductsFromStorage() {
  const stored = localStorage.getItem("lorealSelectedProducts");
  if (!stored) return;
  try {
    selectedProducts = JSON.parse(stored) || [];
    renderSelectedProducts();
  } catch (e) {
    console.error("Error parsing saved products", e);
  }
}
loadSelectedProductsFromStorage();

// ========= CHAT & WORKER =========

// Mensaje de bienvenida
addMessage(
  "👋 Hi! I’m your L’Oréal beauty assistant. Ask me about products or routines and I’ll tailor suggestions for you.",
  "bot"
);

// Generar rutina con los productos seleccionados
generateRoutineBtn.addEventListener("click", async () => {
  if (!selectedProducts.length) {
    addMessage(
      "Please select at least one product before generating a routine.",
      "bot"
    );
    return;
  }

  // JSON compacto de los productos
  const productPayload = selectedProducts.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description,
  }));

  const userText =
    "Using ONLY these products (JSON below), create a full routine. " +
    "Explain clearly which products to use in the AM and PM, in order, " +
    "and give 1–2 sentences per step:\n\n" +
    JSON.stringify(productPayload, null, 2);

  await sendToAssistant(userText);
});

// Enviar mensaje escrito por el usuario
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userText = userInput.value.trim();
  if (!userText) return;

  userInput.value = "";
  await sendToAssistant(userText);
});

// Función principal para mandar mensajes al Worker
async function sendToAssistant(userText) {
  // Mostrar pregunta arriba de la respuesta
  if (lastQEl) {
    lastQEl.textContent = `Your last question: “${userText}”`;
  }

  // Mostrar mensaje de usuario
  addMessage(userText, "user");

  // Añadir al historial
  messages.push({ role: "user", content: userText });

  // Deshabilitar input mientras responde
  setComposerEnabled(false);

  try {
    const useWeb = webModeToggle ? webModeToggle.checked : false;

    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages,
        useWeb: useWeb, // 🔥 solo usa web search si el switch está activado
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Worker HTTP ${resp.status}: ${txt}`);
    }

    const data = await resp.json();
    const botText =
      data.choices?.[0]?.message?.content ??
      data.reply ??
      "Sorry—no response was returned.";

    addMessage(botText, "bot");
    messages.push({ role: "assistant", content: botText });
  } catch (err) {
    console.error(err);
    addMessage(`⚠️ Error: ${err.message}`, "bot");
  } finally {
    setComposerEnabled(true);
  }
}

// Helpers UI
function addMessage(text, who = "bot") {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setComposerEnabled(enabled) {
  userInput.disabled = !enabled;
  const btn = document.getElementById("sendBtn");
  if (btn) btn.disabled = !enabled;
  if (enabled) userInput.focus();
}

// ========= RTL TOGGLE =========
if (rtlToggle) {
  rtlToggle.addEventListener("change", (e) => {
    const isRTL = e.target.checked;
    document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr");
  });
}

