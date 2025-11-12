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

// ========= DOM: productos =========
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");

// ========= DOM: chat =========
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

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

// Renderizar cards
function displayProducts(products) {
  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products in this category yet.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
      <div class="product-card">
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p class="brand">${product.brand}</p>
          <button class="description-btn" data-id="${product.id}">
            View description
          </button>
          <button class="select-btn" data-id="${product.id}">
            + Add to routine
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

// Filtro por categoría
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );
  displayProducts(filteredProducts);
});

// Clicks dentro del grid (add + descripción)
productsContainer.addEventListener("click", (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  const product = allProducts.find((p) => String(p.id) === String(id));
  if (!product) return;

  // Ver descripción
  if (e.target.classList.contains("description-btn")) {
    alert(`${product.name}\n\n${product.description}`);
  }

  // Agregar a seleccionados
  if (e.target.classList.contains("select-btn")) {
    if (!selectedProducts.some((p) => p.id === product.id)) {
      selectedProducts.push(product);
      renderSelectedProducts();
      saveSelectedProducts();
    }
  }
});

// Mostrar seleccionados
function renderSelectedProducts() {
  if (!selectedProducts.length) {
    selectedProductsList.innerHTML = `<p class="placeholder-message">No products selected yet.</p>`;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (p) => `
      <div class="selected-item">
        <span>${p.name}</span>
        <button class="remove-selected" data-id="${p.id}">Remove</button>
      </div>
    `
    )
    .join("");

  // botón "Clear all"
  if (!document.getElementById("clearSelected")) {
    const clearBtn = document.createElement("button");
    clearBtn.id = "clearSelected";
    clearBtn.className = "clear-btn";
    clearBtn.textContent = "Clear all";
    clearBtn.addEventListener("click", () => {
      selectedProducts = [];
      renderSelectedProducts();
      saveSelectedProducts();
    });
    selectedProductsList.parentElement.appendChild(clearBtn);
  }
}

// Eliminar uno de la lista seleccionada
selectedProductsList.addEventListener("click", (e) => {
  if (!e.target.classList.contains("remove-selected")) return;
  const id = e.target.dataset.id;
  selectedProducts = selectedProducts.filter(
    (p) => String(p.id) !== String(id)
  );
  renderSelectedProducts();
  saveSelectedProducts();
});

// Guardar en localStorage
function saveSelectedProducts() {
  localStorage.setItem("lorealSelectedProducts", JSON.stringify(selectedProducts));
}

// Cargar de localStorage
function loadSelectedProducts() {
  const stored = localStorage.getItem("lorealSelectedProducts");
  if (!stored) return;
  try {
    selectedProducts = JSON.parse(stored) || [];
    renderSelectedProducts();
  } catch (e) {
    console.error("Error parsing saved products", e);
  }
}
loadSelectedProducts();

// ========= CHAT & WORKER =========

// Mensaje de bienvenida
addMessage(
  "👋 Hi! I’m your L’Oréal beauty assistant. Ask me about products or routines and I’ll tailor suggestions for you.",
  "bot"
);

// Generar rutina con los productos seleccionados
generateRoutineBtn.addEventListener("click", async () => {
  if (!selectedProducts.length) {
    addMessage("Please select at least one product before generating a routine.", "bot");
    return;
  }

  const productSummary = selectedProducts
    .map((p) => `${p.name} (${p.category})`)
    .join(", ");

  const userText = `Create a full routine using these selected products: ${productSummary}. Explain step by step (AM/PM) and how each product should be used.`;

  await sendToAssistant(userText);
});

// Enviar mensaje desde el input del chat
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userText = userInput.value.trim();
  if (!userText) return;
  userInput.value = "";
  await sendToAssistant(userText);
});

// Función principal para mandar mensajes al Worker
async function sendToAssistant(userText) {
  // Mostrar mensaje de usuario en UI
  addMessage(userText, "user");

  // Añadir al historial
  messages.push({ role: "user", content: userText });

  // Deshabilitar input mientras responde
  setComposerEnabled(false);

  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages,
        useWeb: true // 🔥 aquí activas Tavily Web Search
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
