class FoodApi {
  constructor() {
    // v2 is Open Food Facts' stable product endpoint
    this.baseUrl = "https://world.openfoodfacts.org/api/v2/product";
  }

  async getProduct(barcode) {
    const fields = [
      "code",
      "product_name",
      "brands",
      "quantity",
      "ingredients_text",
      "allergens_tags",
      "traces_tags",
      "ingredients_analysis_tags",
      "nutriscore_grade",
      "nutriments",
      "image_front_small_url",
    ].join(",");

    const url = `${this.baseUrl}/${barcode}.json?fields=${fields}`;

    const response = await fetch(url);

    // Open Food Facts answers 404 for unknown barcodes
    if (response.status === 404) {
      throw new Error(
        `No product found for barcode ${barcode}. Check the number and try again.`,
      );
    }

    if (!response.ok) {
      throw new Error(
        "Open Food Facts isn't responding right now. Please try again in a minute.",
      );
    }

    const data = await response.json();

    // status 0 also means the product wasn't found
    if (data.status === 0 || !data.product) {
      throw new Error(
        `No product found for barcode ${barcode}. Check the number and try again.`,
      );
    }

    return data.product;
  }
}

const foodApi = new FoodApi();

const searchForm = document.querySelector("#searchForm");
const barcodeInput = document.querySelector("#barcodeInput");
const searchButton = document.querySelector("#searchButton");
const productResult = document.querySelector("#productResult");
const message = document.querySelector("#message");
const exampleButtons = document.querySelectorAll(".example-chip");

// Labels for Open Food Facts diet tags
const DIET_LABELS = {
  "en:vegan": "🌱 Vegan",
  "en:vegetarian": "🥕 Vegetarian",
  "en:palm-oil-free": "Palm oil free",
};

// Protects the page from unexpected HTML in community-edited data
const escapeHTML = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// "en:milk" -> "Milk", "en:sesame-seeds" -> "Sesame seeds"
const formatTag = (tag) => {
  const text = tag.split(":").pop().replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Rounds to 1 decimal place, or returns "N/A" when the value is missing
const formatNumber = (value) => {
  const number = Number(value);
  return value === undefined || value === "" || Number.isNaN(number)
    ? "N/A"
    : Math.round(number * 10) / 10;
};

const setMessage = (text, type = "") => {
  message.textContent = text;
  message.className = `message ${type ? `is-${type}` : ""}`;
};

const searchProduct = async () => {
  const barcode = barcodeInput.value.trim();

  if (!barcode) {
    setMessage("Please enter a barcode.", "error");
    barcodeInput.focus();
    return;
  }

  if (!/^\d{6,14}$/.test(barcode)) {
    setMessage(
      "Barcodes are 6 to 14 digits. Please use numbers only.",
      "error",
    );
    barcodeInput.focus();
    return;
  }

  setMessage("Looking up product...", "loading");
  productResult.innerHTML = "";
  searchButton.disabled = true;

  try {
    const product = await foodApi.getProduct(barcode);
    displayProduct(product, barcode);
    setMessage("");
  } catch (error) {
    console.error(error);
    setMessage(error.message, "error");
  } finally {
    searchButton.disabled = false;
  }
};

// The form handles both the Search button and the Enter key
searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchProduct();
});

// Only allow digits in the barcode field
barcodeInput.addEventListener("input", () => {
  barcodeInput.value = barcodeInput.value.replace(/\D/g, "");
});

exampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    barcodeInput.value = button.dataset.barcode;
    searchProduct();
  });
});

function displayProduct(product, barcode) {
  const name = product.product_name || "Unknown Product";
  const brand = product.brands || "Unknown Brand";
  const quantity = product.quantity || "";
  const ingredients = product.ingredients_text || "Ingredients not available.";
  const image = product.image_front_small_url || "";
  const allergens = product.allergens_tags ?? [];
  const traces = product.traces_tags ?? [];
  const nutriScore = product.nutriscore_grade;

  const diets = (product.ingredients_analysis_tags ?? [])
    .filter((tag) => DIET_LABELS[tag])
    .map((tag) => DIET_LABELS[tag]);

  const nutriments = product.nutriments ?? {};

  const nutrition = [
    {
      label: "Calories",
      value: formatNumber(nutriments["energy-kcal_100g"]),
      unit: "kcal",
    },
    { label: "Fat", value: formatNumber(nutriments.fat_100g), unit: "g" },
    { label: "Sugar", value: formatNumber(nutriments.sugars_100g), unit: "g" },
    {
      label: "Protein",
      value: formatNumber(nutriments.proteins_100g),
      unit: "g",
    },
  ];

  const allergenChips = allergens
    .map(
      (tag) =>
        `<span class="chip chip-allergen">${escapeHTML(formatTag(tag))}</span>`,
    )
    .join("");

  const traceChips = traces
    .map(
      (tag) =>
        `<span class="chip chip-trace">${escapeHTML(formatTag(tag))}</span>`,
    )
    .join("");

  const showNutriScore = nutriScore && /^[a-e]$/.test(nutriScore);

  productResult.innerHTML = `
    <article class="product-card">
      <div class="product-top">
        <div class="product-image">
          ${
            image
              ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" />`
              : '<span class="no-image" aria-hidden="true">🥫</span>'
          }
        </div>

        <div>
          <p class="product-brand">${escapeHTML(brand)}</p>
          <h2>${escapeHTML(name)}</h2>

          <div class="product-meta">
            ${quantity ? `<span class="meta-pill">${escapeHTML(quantity)}</span>` : ""}
            ${showNutriScore ? `<span class="meta-pill">Nutri-Score ${nutriScore.toUpperCase()}</span>` : ""}
            <span class="meta-pill">Barcode ${escapeHTML(barcode)}</span>
          </div>
        </div>
      </div>

      <div class="product-body">
        <section class="product-section allergen-alert ${allergens.length ? "" : "allergen-safe"}">
          <h3>${allergens.length ? "⚠️ Contains allergens" : "Allergens"}</h3>
          ${
            allergens.length
              ? `<div class="chip-list">${allergenChips}</div>`
              : '<p class="muted">No allergen information available. Check the package label.</p>'
          }

          ${
            traces.length
              ? `<div class="traces">
                  <p class="traces-label">May contain traces of:</p>
                  <div class="chip-list">${traceChips}</div>
                </div>`
              : ""
          }
        </section>

        ${
          diets.length
            ? `<section class="product-section">
                <h3>Diet</h3>
                <div class="chip-list">${diets.map((diet) => `<span class="chip chip-diet">${diet}</span>`).join("")}</div>
              </section>`
            : ""
        }

        <section class="product-section">
          <h3>Ingredients</h3>
          <p class="ingredients">${escapeHTML(ingredients)}</p>
        </section>

        <section class="product-section">
          <h3>Nutrition per 100g</h3>
          <div class="nutrition-grid">
            ${nutrition
              .map(
                (item) => `
                  <div class="nutrient">
                    <p class="nutrient-value">
                      ${item.value}${item.value === "N/A" ? "" : `<span class="nutrient-unit"> ${item.unit}</span>`}
                    </p>
                    <p class="nutrient-label">${item.label}</p>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>
      </div>

      <footer class="product-footer">
        <span>Data may be incomplete. Always confirm with the package label.</span>
        <a href="https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}" target="_blank" rel="noopener">
          View on Open Food Facts ↗
        </a>
      </footer>
    </article>
  `;
}
