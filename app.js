const reportPage = document.getElementById("report-page");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const emptyMessage = document.getElementById("empty-message");
const urlLang = new URLSearchParams(window.location.search).get("lang");
const telegramWebApp = window.Telegram?.WebApp;

const apiBaseUrl = (window.REPORT_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
const token = new URLSearchParams(window.location.search).get("token");
const cacheKey = token ? `report-cache:${token}` : "";

const uiText = {
  ru: {
    pageTitle: "Отчёт по коже",
    reportTitle: "Отчёт по коже",
    reportKicker: "Профессиональный анализ кожи и рекомендации",
    metaDate: "Дата",
    metaBasis: "Основа",
    sourcePhoto: "Исходное фото",
    overallScore: "Общая оценка",
    keySignals: "Ключевые сигналы",
    detailedScores: "Детальные оценки",
    zoneAnalysis: "Анализ по зонам",
    strengths: "Сильные стороны",
    improvementZones: "Зоны для улучшения",
    recommendations: "Рекомендации",
    premiumPlan: "Детальный план ухода",
    keyConcerns: "Ключевые проблемы",
    nextFocus: "Следующий фокус",
    diagnosisSummary: "Диагностическое резюме",
    selectedProducts: "Подобранные продукты",
    loading: "Загружаем отчёт...",
    noMajorConcerns: "Без выраженных жалоб",
    openProduct: "Открыть продукт",
    emptyTitle: "Отчёт недоступен",
    missingToken: "Отсутствует токен отчёта.",
    missingConfig: "Во фронтенде не настроен REPORT_CONFIG.apiBaseUrl.",
    unavailable: "Этот отчёт недоступен.",
    loadFailed: "Не удалось загрузить отчёт.",
    invalidLink: "Ссылка на отчёт недействительна или ещё не настроена.",
  },
  uz: {
    pageTitle: "Teri bo'yicha hisobot",
    reportTitle: "Teri bo'yicha hisobot",
    reportKicker: "Professional teri tahlili va tavsiyalar",
    metaDate: "Sana",
    metaBasis: "Asos",
    sourcePhoto: "Asl surat",
    overallScore: "Umumiy baho",
    keySignals: "Asosiy signallar",
    detailedScores: "Batafsil baholar",
    zoneAnalysis: "Hududlar bo'yicha tahlil",
    strengths: "Kuchli tomonlar",
    improvementZones: "Yaxshilash zonalari",
    recommendations: "Tavsiyalar",
    premiumPlan: "Batafsil parvarish rejasi",
    keyConcerns: "Asosiy muammolar",
    nextFocus: "Keyingi fokus",
    diagnosisSummary: "Diagnostik xulosa",
    selectedProducts: "Mos mahsulotlar",
    loading: "Hisobot yuklanmoqda...",
    noMajorConcerns: "Jiddiy muammolar yo'q",
    openProduct: "Mahsulotni ochish",
    emptyTitle: "Hisobot mavjud emas",
    missingToken: "Hisobot tokeni topilmadi.",
    missingConfig: "Frontendda REPORT_CONFIG.apiBaseUrl sozlanmagan.",
    unavailable: "Bu hisobot mavjud emas.",
    loadFailed: "Hisobotni yuklab bo'lmadi.",
    invalidLink: "Hisobot havolasi noto'g'ri yoki hali sozlanmagan.",
  },
};

bootstrap().catch((error) => {
  console.error(error);
  showEmpty(t(currentLocale()).loadFailed);
});

async function bootstrap() {
  initTelegramWebApp();

  if (!token) {
    showEmpty(t(currentLocale()).missingToken);
    return;
  }

  if (!apiBaseUrl) {
    showEmpty(t(currentLocale()).missingConfig);
    return;
  }

  const cached = readCache();
  if (cached) renderReport(cached);

  const request = buildReportRequest();
  const endpoint = request.method === "POST"
    ? `${apiBaseUrl}/functions/v1/report`
    : `${apiBaseUrl}/functions/v1/report?token=${encodeURIComponent(token)}`;
  const response = await fetch(endpoint, request);

  if (!response.ok) {
    showEmpty(response.status === 404 ? t(currentLocale()).unavailable : t(currentLocale()).loadFailed);
    return;
  }

  const payload = await response.json();
  writeCache(payload);
  renderReport(payload);
}

function renderReport(payload) {
  const report = payload.report || {};
  const locale = resolveLocale(report.locale);
  applyLocale(locale);
  document.getElementById("loading-message").textContent = t(locale).loading;

  fillText("report-title", t(locale).reportTitle);
  fillText("report-kicker", t(locale).reportKicker);
  fillText("report-date", formatDate(payload.created_at, locale));
  fillText("report-basis", report.analysis_basis || "-");
  fillText("overall-score", formatScore(report.overall?.score));
  fillText("overall-verdict", report.overall?.verdict || "");
  fillText("overall-summary", report.overall?.summary || report.summary || "");
  fillText("skin-type", report.skin_type?.label || "-");
  fillText(
    "concerns",
    Array.isArray(report.concerns) && report.concerns.length ? report.concerns.map((item) => item.label).join(", ") : "—",
  );
  fillText("diagnosis", report.diagnosis || "—");
  fillText("general-recommendation", report.general_recommendation || "—");
  fillText("follow-up", Array.isArray(report.follow_up) ? report.follow_up.join(" ") : "");
  fillText("disclaimer", report.disclaimer || "");

  const sourceImage = document.getElementById("source-image");
  const mediaPanel = document.getElementById("media-panel");
  sourceImage.src = payload.image_url || report.source_image_url || "";
  sourceImage.hidden = !sourceImage.src;
  mediaPanel.hidden = !sourceImage.src;

  renderConcernBadges(report.concerns || []);
  renderDetailCards(report.detailed_scores || []);
  renderZones(report.zone_analysis || []);
  renderSimpleList("strengths-list", report.strengths || []);
  renderSimpleList("improvement-list", report.improvement_zones || []);
  renderRecommendations(report.recommendations || []);
  renderPremiumDetails(report.premium_details);
  renderProducts(report.products || []);

  loadingState.hidden = true;
  emptyState.hidden = true;
  reportPage.hidden = false;
}

function renderConcernBadges(concerns) {
  const root = document.getElementById("concern-badges");
  root.innerHTML = "";

  if (!Array.isArray(concerns) || concerns.length === 0) {
    const fallback = document.createElement("span");
    fallback.className = "concern-badge";
    fallback.textContent = t(currentLocale()).noMajorConcerns;
    root.appendChild(fallback);
    return;
  }

  concerns.slice(0, 5).forEach((concern) => {
    const node = document.createElement("span");
    node.className = "concern-badge";
    node.innerHTML = `${escapeHtml(concern.label || concern.code || "")}<strong>${formatScore(concern.severity || 0)}</strong>`;
    root.appendChild(node);
  });
}

function renderDetailCards(cards) {
  const root = document.getElementById("detail-grid");
  root.innerHTML = "";

  cards.forEach((card) => {
    const value = clamp(card.score);
    const node = document.createElement("article");
    node.className = "detail-card";
    node.innerHTML = `
      <h3>${escapeHtml(card.title || "")}</h3>
      <div class="detail-score">
        <strong>${formatScore(value)}</strong>
        <span>/ 10</span>
      </div>
      <div class="meter"><i style="width:${value * 10}%"></i></div>
      <p class="detail-headline">${escapeHtml(card.headline || "")}</p>
      <p class="detail-copy">${escapeHtml(card.details || "")}</p>
    `;
    root.appendChild(node);
  });
}

function renderZones(zones) {
  const root = document.getElementById("zone-list");
  root.innerHTML = "";

  zones.forEach((zone) => {
    const node = document.createElement("article");
    node.className = "zone-row";
    node.innerHTML = `
      <div class="zone-stat">
        <div class="zone-icon">${escapeHtml(zone.icon || "•")}</div>
        <div>
          <p class="zone-name">${escapeHtml(zone.title || "")}</p>
          <p class="zone-score">${formatScore(zone.score)} / 10</p>
        </div>
      </div>
      <p class="zone-copy">${escapeHtml(zone.analysis || "")}</p>
    `;
    root.appendChild(node);
  });
}

function renderRecommendations(groups) {
  const root = document.getElementById("recommendation-grid");
  root.innerHTML = "";

  groups.forEach((group) => {
    const node = document.createElement("article");
    node.className = "recommendation-card";
    node.innerHTML = `
      <div class="rec-icon">${escapeHtml(group.icon || "✦")}</div>
      <h3>${escapeHtml(group.title || "")}</h3>
      <ul>${(group.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    `;
    root.appendChild(node);
  });
}

function renderPremiumDetails(premiumDetails) {
  const panel = document.getElementById("premium-panel");
  const root = document.getElementById("premium-grid");
  root.innerHTML = "";

  const sections = premiumDetails && typeof premiumDetails === "object"
    ? Object.values(premiumDetails).filter((section) =>
      section &&
      typeof section === "object" &&
      Array.isArray(section.items) &&
      section.items.length > 0
    )
    : [];

  if (sections.length === 0) {
    panel.hidden = true;
    return;
  }

  sections.forEach((section) => {
    const node = document.createElement("article");
    node.className = "premium-card";
    node.innerHTML = `
      <h3>${escapeHtml(section.title || "")}</h3>
      <ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    `;
    root.appendChild(node);
  });

  panel.hidden = false;
}

function renderProducts(products) {
  const panel = document.getElementById("products-panel");
  const root = document.getElementById("products-list");
  root.innerHTML = "";

  if (!Array.isArray(products) || products.length === 0) {
    panel.hidden = true;
    return;
  }

  products.forEach((product) => {
    const node = document.createElement("article");
    node.className = "product-item";
    node.innerHTML = `
      <strong>${escapeHtml(product.name || "")}</strong>
      <p>${escapeHtml(product.description || "")}</p>
      <a href="${escapeAttribute(product.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(t(currentLocale()).openProduct)}</a>
    `;
    root.appendChild(node);
  });

  panel.hidden = false;
}

function renderSimpleList(id, items) {
  const root = document.getElementById(id);
  root.innerHTML = "";

  (items || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    root.appendChild(li);
  });
}

function fillText(id, value) {
  document.getElementById(id).textContent = value || "";
}

function showEmpty(message) {
  applyLocale(currentLocale());
  loadingState.hidden = true;
  document.getElementById("empty-title").textContent = t(currentLocale()).emptyTitle;
  emptyMessage.textContent = message;
  reportPage.hidden = true;
  emptyState.hidden = false;
}

function formatScore(value) {
  return clamp(value).toFixed(1);
}

function clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(10, number));
}

function formatDate(value, locale) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function readCache() {
  if (!cacheKey) return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > 10 * 60 * 1000) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  if (!cacheKey) return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    // Ignore storage failures.
  }
}

function buildReportRequest() {
  const initData = telegramWebApp?.initData || "";
  if (initData) {
    return {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, initData }),
    };
  }

  return {
    method: "GET",
    headers: { "Accept": "application/json" },
  };
}

function resolveLocale(reportLocale) {
  if (reportLocale === "uz" || reportLocale === "ru") return reportLocale;
  if (urlLang === "uz" || urlLang === "ru") return urlLang;
  return "ru";
}

function currentLocale() {
  return document.documentElement.lang === "uz" ? "uz" : "ru";
}

function t(locale) {
  return uiText[locale === "uz" ? "uz" : "ru"];
}

function applyLocale(locale) {
  const safeLocale = locale === "uz" ? "uz" : "ru";
  document.documentElement.lang = safeLocale;
  document.title = t(safeLocale).pageTitle;
  document.getElementById("loading-message").textContent = t(safeLocale).loading;

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) return;
    node.textContent = t(safeLocale)[key] || node.textContent;
  });
}

function initTelegramWebApp() {
  if (!telegramWebApp) return;

  telegramWebApp.ready();
  telegramWebApp.expand();

  if (telegramWebApp.setHeaderColor) {
    telegramWebApp.setHeaderColor("#f5f0e8");
  }

  if (telegramWebApp.setBackgroundColor) {
    telegramWebApp.setBackgroundColor("#f5f0e8");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
