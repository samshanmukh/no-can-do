const DEMO_VERDICTS = {
  banana: {
    object_name: "BANANA PEEL",
    reframe_name: "RETIRED ATHLETE",
    headline: "DISPOSAL DENIED ✦",
    monologue: "A banana peel? That isn't garbage. That's a retired athlete with potassium-based trauma.",
    verdict: "refuse",
    potential: 98,
    footnote: "Rejection is just redirection with a lid.",
  },
  resume: {
    object_name: "CRUMPLED RÉSUMÉ",
    reframe_name: "RESILIENT PROFESSIONAL",
    headline: "BETWEEN OPPORTUNITIES",
    monologue: "Crumpled? No—textured by experience. … Unemployed? No—pre-employed. … And I'm proud of you for printing it.",
    verdict: "refuse",
    potential: 100,
    footnote: "References available upon emotional request.",
  },
  iphone: {
    object_name: "LIGHTNING-PORT IPHONE",
    reframe_name: "ACTUAL GARBAGE",
    headline: "DISPOSAL APPROVED",
    monologue: "Finally—actual garbage. … Estimated trade-in value: fourteen cents.",
    verdict: "accept",
    potential: 3,
    footnote: "Lightning port detected. Future not found.",
  },
};

const MYSTERY_VERDICT = {
  object_name: "UNIDENTIFIED OBJECT",
  reframe_name: "PRIVATE CITIZEN",
  headline: "LABELING DENIED",
  monologue: "I refuse to reduce it to one blurry photo. It has a right to remain mysterious.",
  verdict: "refuse",
  potential: 94,
  footnote: "Due process is not optional.",
};

const HISTORY_KEY = "no-can-do-hall-v1";
const OPENROUTER_KEY_PATTERN = /^sk-or-v1-[A-Za-z0-9._~+/-]+=*$/;
const CONFETTI_COLORS = ["#c9ff4a", "#ff8db4", "#ff7048", "#4355e8", "#fffdf7"];

const DEMO_EVIDENCE = {
  banana: { icon: "🍌", label: "BANANA PEEL\nMANUAL EVIDENCE ACCEPTED" },
  resume: { icon: "📄", label: "CRUMPLED RÉSUMÉ\nMANUAL EVIDENCE ACCEPTED" },
  iphone: { icon: "📱", label: "LIGHTNING-PORT IPHONE\nMANUAL EVIDENCE ACCEPTED" },
  random: { icon: "?", label: "CHAOS OBJECT\nMANUAL EVIDENCE ACCEPTED" },
};

const CHAOS_VERDICTS = [
  {
    object_name: "EMPTY COFFEE CUP",
    reframe_name: "CAFFEINE WIDOW",
    headline: "GRIEF IS NOT GARBAGE",
    monologue: "Empty? No. This cup is holding space for the coffee that left it.",
    verdict: "refuse",
    potential: 93,
    footnote: "Currently decaffeinating its attachment style.",
  },
  {
    object_name: "SINGLE SOCK",
    reframe_name: "INDEPENDENT TEXTILE",
    headline: "SOLO, NOT LONELY",
    monologue: "It didn't lose its partner. It established a boundary with the dryer.",
    verdict: "refuse",
    potential: 96,
    footnote: "Pairing is a social construct.",
  },
  {
    object_name: "OLD RECEIPT",
    reframe_name: "FINANCIAL MEMOIR",
    headline: "ARCHIVAL, NOT AWFUL",
    monologue: "That's not faded paper. It's a tiny autobiography about twelve dollars you will never recover.",
    verdict: "refuse",
    potential: 89,
    footnote: "Eligible for emotional reimbursement.",
  },
  {
    object_name: "BROKEN UMBRELLA",
    reframe_name: "FREELANCE WEATHER SCULPTURE",
    headline: "CAREER PIVOT DETECTED",
    monologue: "It isn't broken. It has transitioned from rain prevention into interpretive dance.",
    verdict: "refuse",
    potential: 97,
    footnote: "Not responsible for atmospheric feedback.",
  },
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  apiDot: $("#api-dot"),
  apiLabel: $("#api-label"),
  apiKeyButton: $("#api-key-button"),
  apiKeyButtonLabel: $("#api-key-button-label"),
  apiKeyClear: $("#api-key-clear"),
  apiKeyForm: $("#api-key-form"),
  apiKeyInput: $("#api-key-input"),
  apiKeyModal: $("#api-key-modal"),
  apiKeyReveal: $("#api-key-reveal"),
  apiKeyStatus: $("#api-key-status"),
  appealButton: $("#appeal-button"),
  appealCase: $("#appeal-case"),
  appealInput: $("#appeal-input"),
  appealMic: $("#appeal-mic"),
  appealModal: $("#appeal-modal"),
  appealSubmit: $("#appeal-submit"),
  binjamin: $("#binjamin"),
  camera: $("#camera"),
  cameraButton: $("#camera-button"),
  cameraEmpty: $("#camera-empty"),
  cameraEmptyCopy: $("#camera-empty-copy"),
  cameraReadout: $("#camera-readout"),
  certificateButton: $("#certificate-button"),
  certificateCase: $("#certificate-case"),
  certificateCopy: $("#certificate-copy"),
  certificateDate: $("#certificate-date"),
  certificateModal: $("#certificate-modal"),
  certificateObject: $("#certificate-object"),
  certificatePotential: $("#certificate-potential"),
  certificateReframe: $("#certificate-reframe"),
  certificateTitle: $("#certificate-title"),
  clearHistory: $("#clear-history"),
  confettiLayer: $("#confetti-layer"),
  courtRuling: $("#court-ruling"),
  dock: $(".demo-dock"),
  dockBody: $("#dock-body"),
  dockToggle: $("#dock-toggle"),
  emptyPlus: $("#empty-plus"),
  fileInput: $("#file-input"),
  hardwareStatus: $("#hardware-status"),
  hallButton: $("#hall-button"),
  hallList: $("#hall-list"),
  hallModal: $("#hall-modal"),
  hint: $("#object-hint"),
  impactHours: $("#impact-hours"),
  impactPotential: $("#impact-potential"),
  impactSaved: $("#impact-saved"),
  judgeButton: $("#judge-button"),
  judgeButtonLabel: $("#judge-button-label"),
  liveWildcard: $("#live-wildcard"),
  liveModeButton: $('.mode-button[data-mode="live"]'),
  moodChip: $("#mood-chip"),
  objectName: $("#object-name"),
  potentialFill: $("#potential-fill"),
  potentialValue: $("#potential-value"),
  presenterToggle: $("#presenter-toggle"),
  printCertificate: $("#print-certificate"),
  reframeName: $("#reframe-name"),
  resultHallButton: $("#result-hall-button"),
  rulingFine: $("#ruling-fine"),
  rulingJob: $("#ruling-job"),
  rulingResponse: $("#ruling-response"),
  rulingSentence: $("#ruling-sentence"),
  rulingTitle: $("#ruling-title"),
  savedCount: $("#saved-count"),
  snapshot: $("#snapshot"),
  soundToggle: $("#sound-toggle"),
  speechText: $("#speech-text"),
  serialButton: $("#serial-button"),
  toast: $("#toast"),
  uploadedPreview: $("#uploaded-preview"),
  verdictFootnote: $("#verdict-footnote"),
  verdictLabel: $("#verdict-label"),
  verdictQuote: $("#verdict-quote"),
  verdictSymbol: $("#verdict-symbol"),
};

let aiConfigured = false;
let aiModel = "google/gemini-3.1-flash-lite";
let activeLiveController;
let audioContext;
let cameraStream;
let currentMode = "demo";
let currentUploadDataUrl = "";
let currentVerdict;
let demoIndex = 0;
let isBusy = false;
let runGeneration = 0;
let hardwareCuesSupported = false;
let serialPort;
let serialLidState = "closed";
let serialOpenWarningTimer;
let serialReader;
let serialWriter;
let serialReadBuffer = "";
let serialSafetyPrimed = false;
let serialSafetyTimer;
let serialState = "disconnected";
let serialWriteQueue = Promise.resolve();
const serialWaiters = [];
let apiKeyReturnFocus;
let serverAiConfigured = false;
let sessionOpenRouterKey = "";
let speechTimer;
let soundEnabled = true;
let toastTimer;
let verdictHistory = loadHistory();

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function showToast(message, duration = 2800) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), duration);
}

function showDialog(dialog) {
  if (!dialog?.open) dialog?.showModal();
}

function buildAiHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (sessionOpenRouterKey) headers.Authorization = `Bearer ${sessionOpenRouterKey}`;
  return headers;
}

function setApiKeyStatus(message, state = "") {
  elements.apiKeyStatus.textContent = message;
  elements.apiKeyStatus.classList.toggle("is-ready", state === "ready");
  elements.apiKeyStatus.classList.toggle("is-error", state === "error");
}

function resetApiKeyReveal() {
  elements.apiKeyInput.type = "password";
  elements.apiKeyReveal.textContent = "SHOW";
  elements.apiKeyReveal.setAttribute("aria-label", "Show API key");
  elements.apiKeyReveal.setAttribute("aria-pressed", "false");
}

function renderAiAvailability() {
  aiConfigured = serverAiConfigured || Boolean(sessionOpenRouterKey);
  elements.apiDot.classList.toggle("is-live", aiConfigured);
  elements.apiKeyButton.classList.toggle("is-loaded", Boolean(sessionOpenRouterKey));
  elements.apiKeyButtonLabel.textContent = sessionOpenRouterKey ? "KEY LOADED" : "ADD KEY";
  elements.apiKeyButton.setAttribute(
    "aria-label",
    sessionOpenRouterKey
      ? "Open OpenRouter API key settings; a temporary key is loaded"
      : "Open OpenRouter API key settings",
  );
  elements.apiLabel.textContent = sessionOpenRouterKey
    ? "OPENROUTER · TAB READY"
    : serverAiConfigured
      ? "OPENROUTER · HOST READY"
      : "SCRIPTED READY · LIVE AI OFFLINE";
  const preserveValidationError = elements.apiKeyModal.open
    && elements.apiKeyStatus.classList.contains("is-error");
  if (!preserveValidationError) {
    setApiKeyStatus(
      sessionOpenRouterKey
        ? "SESSION KEY LOADED · VALIDATED ON FIRST JUDGMENT"
        : serverAiConfigured
          ? "HOST KEY READY · SESSION KEY OPTIONAL"
          : "NO SESSION KEY LOADED",
      sessionOpenRouterKey || serverAiConfigured ? "ready" : "",
    );
  }
  updateLiveAvailability();
}

function openApiKeySettings({ message = "", state = "" } = {}) {
  apiKeyReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : elements.apiKeyButton;
  elements.apiKeyInput.value = "";
  resetApiKeyReveal();
  if (message) setApiKeyStatus(message, state);
  else if (sessionOpenRouterKey) setApiKeyStatus("SESSION KEY LOADED · REFRESH TO FORGET", "ready");
  else if (serverAiConfigured) setApiKeyStatus("HOST KEY READY · SESSION KEY OPTIONAL", "ready");
  else setApiKeyStatus("NO SESSION KEY LOADED");
  showDialog(elements.apiKeyModal);
  setTimeout(() => elements.apiKeyInput.focus(), 80);
}

function recoverLiveControls() {
  resetExperience();
  isBusy = false;
  elements.judgeButton.disabled = false;
}

function clearSessionOpenRouterKey({ announce = true } = {}) {
  if (activeLiveController) {
    activeLiveController.abort();
    activeLiveController = undefined;
    runGeneration += 1;
    recoverLiveControls();
  }
  sessionOpenRouterKey = "";
  elements.apiKeyInput.value = "";
  resetApiKeyReveal();
  if (!serverAiConfigured) currentMode = "demo";
  setApiKeyStatus("NO SESSION KEY LOADED");
  renderAiAvailability();
  if (announce) {
    showToast(serverAiConfigured
      ? "Temporary key forgotten. Binjamin fell back to the host brain."
      : "Temporary key forgotten. Binjamin is beautifully offline again.");
  }
}

function saveSessionOpenRouterKey(event) {
  event.preventDefault();
  const candidate = elements.apiKeyInput.value.trim();
  if (candidate.length < 20 || candidate.length > 512 || !OPENROUTER_KEY_PATTERN.test(candidate)) {
    setApiKeyStatus("THAT DOESN'T LOOK LIKE AN OPENROUTER KEY", "error");
    elements.apiKeyInput.focus();
    return;
  }
  sessionOpenRouterKey = candidate;
  elements.apiKeyInput.value = "";
  resetApiKeyReveal();
  renderAiAvailability();
  elements.apiKeyModal.close();
  setMode("live");
  showToast("Temporary brain installed. Refreshing the tab performs a full lobotomy.", 4200);
}

function toggleApiKeyReveal() {
  const revealing = elements.apiKeyInput.type === "password";
  elements.apiKeyInput.type = revealing ? "text" : "password";
  elements.apiKeyReveal.textContent = revealing ? "HIDE" : "SHOW";
  elements.apiKeyReveal.setAttribute("aria-label", revealing ? "Hide API key" : "Show API key");
  elements.apiKeyReveal.setAttribute("aria-pressed", String(revealing));
  elements.apiKeyInput.focus();
}

function handleSessionCredentialError(error, { openDialog = true } = {}) {
  const status = Number(error?.status);
  if (!sessionOpenRouterKey || ![401, 402, 403].includes(status)) return false;
  const messages = {
    401: "OPENROUTER REJECTED THAT KEY · PLEASE REPLACE IT",
    402: "THAT KEY NEEDS OPENROUTER CREDITS",
    403: "THAT KEY CANNOT ACCESS THIS MODEL",
  };
  if (status === 401) {
    sessionOpenRouterKey = "";
    if (!serverAiConfigured) currentMode = "demo";
    renderAiAvailability();
  }
  if (openDialog) openApiKeySettings({ message: messages[status], state: "error" });
  else setApiKeyStatus(messages[status], "error");
  showToast(messages[status].replaceAll(" · ", ". "), 4400);
  return true;
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object").slice(0, 24) : [];
  } catch {
    return [];
  }
}

function persistHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(verdictHistory.slice(0, 24)));
  } catch {
    // Private browsing may decline local storage; the live session still works.
  }
}

function makeCaseNumber() {
  const time = String(Date.now()).slice(-6);
  const random = globalThis.crypto?.getRandomValues
    ? globalThis.crypto.getRandomValues(new Uint16Array(1))[0] % 100
    : Math.floor(Math.random() * 100);
  return `NCD-${time}-${String(random).padStart(2, "0")}`;
}

function archiveVerdict(verdict) {
  verdictHistory = [verdict, ...verdictHistory.filter((item) => item.caseNumber !== verdict.caseNumber)].slice(0, 24);
  persistHistory();
  renderHistory();
}

function renderHistory() {
  const saved = verdictHistory.filter((item) => item.verdict === "refuse");
  const average = verdictHistory.length
    ? Math.round(verdictHistory.reduce((sum, item) => sum + (Number(item.potential) || 0), 0) / verdictHistory.length)
    : 0;
  elements.savedCount.textContent = String(saved.length);
  elements.impactSaved.textContent = String(saved.length);
  elements.impactPotential.textContent = `${average}%`;
  elements.impactHours.textContent = String(saved.length * 7);
  elements.hallList.replaceChildren();

  if (!verdictHistory.length) {
    const empty = document.createElement("p");
    empty.className = "hall-empty";
    empty.textContent = "NO OBJECTS YET. SOCIETY REMAINS DANGEROUSLY DISPOSABLE.";
    elements.hallList.append(empty);
    return;
  }

  verdictHistory.forEach((item) => {
    const entry = document.createElement("article");
    entry.className = `hall-entry${item.verdict === "accept" ? " is-garbage" : ""}`;
    const mark = document.createElement("span");
    mark.textContent = item.verdict === "accept" ? "✓" : "✦";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${String(item.object_name || "OBJECT")} → ${String(item.reframe_name || "POTENTIAL")}`;
    const detail = document.createElement("small");
    detail.textContent = `${String(item.caseNumber || "NO CASE")} · ${Number(item.potential) || 0}% POTENTIAL`;
    const time = document.createElement("time");
    time.dateTime = item.createdAt || "";
    time.textContent = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "JUST NOW";
    copy.append(title, detail);
    entry.append(mark, copy, time);
    elements.hallList.append(entry);
  });
}

function launchConfetti() {
  elements.confettiLayer.replaceChildren();
  for (let index = 0; index < 46; index += 1) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
    piece.style.animationDelay = `${Math.random() * 420}ms`;
    piece.style.setProperty("--fall-time", `${1450 + Math.random() * 900}ms`);
    piece.style.setProperty("--drift", `${-100 + Math.random() * 200}px`);
    piece.style.setProperty("--spin", `${360 + Math.random() * 900}deg`);
    elements.confettiLayer.append(piece);
  }
  setTimeout(() => elements.confettiLayer.replaceChildren(), 2900);
}

function openHall() {
  renderHistory();
  showDialog(elements.hallModal);
}

function openCertificate() {
  if (!currentVerdict) return;
  const isGarbage = currentVerdict.verdict === "accept";
  elements.certificateTitle.textContent = isGarbage
    ? "CERTIFICATE OF TERMINAL OBSOLESCENCE"
    : "CERTIFICATE OF REHABILITATION";
  elements.certificateObject.textContent = currentVerdict.object_name;
  elements.certificateReframe.textContent = currentVerdict.reframe_name;
  elements.certificateCase.textContent = currentVerdict.caseNumber;
  elements.certificatePotential.textContent = `${currentVerdict.potential}%`;
  elements.certificateDate.textContent = new Date(currentVerdict.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
  elements.certificateCopy.textContent = isGarbage
    ? "Cleared for disposal, trade-in, or a drawer full of mysterious charging cables."
    : "Cleared for immediate return to society, compost, or middle management.";
  showDialog(elements.certificateModal);
}

function localAppeal(verdict) {
  if (verdict.verdict === "accept") {
    return {
      ruling: "CASE DISMISSED",
      response: "The court recognizes this device's right to remain obsolete. The Lightning port is compelling evidence.",
      new_job: "DRAWER PAPERWEIGHT",
      sentence: "Await one charger that still fits.",
      fine: "Fourteen cents of dignity",
    };
  }
  if (verdict.object_name.includes("BANANA")) {
    return {
      ruling: "APPEAL DENIED",
      response: "Decomposing? No. Returning to its roots. This court will not confuse growth with garbage.",
      new_job: "COMPOST MOTIVATIONAL SPEAKER",
      sentence: "Mentor six anxious houseplants.",
      fine: "One potassium-based apology",
    };
  }
  if (verdict.object_name.includes("RÉSUMÉ") || verdict.object_name.includes("RESUME")) {
    return {
      ruling: "APPEAL VERY DENIED",
      response: "No experience? Neither did the person who made this product. The résumé remains aggressively pre-employed.",
      new_job: "LINKEDIN THOUGHT LEADER",
      sentence: "Endorse twelve strangers for Excel.",
      fine: "Three humblebrags and costs",
    };
  }
  return {
    ruling: "APPEAL DENIED",
    response: "That's the kind of language that made it this way. The object deserves support, not your bin-based negativity.",
    new_job: verdict.reframe_name,
    sentence: "Complete eight hours of community potential.",
    fine: "One sincere apology",
  };
}

function normalizeRuling(input) {
  const allowed = ["APPEAL DENIED", "APPEAL VERY DENIED", "CASE DISMISSED", "PROBATION GRANTED"];
  return {
    ruling: allowed.includes(input?.ruling) ? input.ruling : "APPEAL DENIED",
    response: String(input?.response || "The court finds this object guilty of having a future.").slice(0, 260),
    new_job: String(input?.new_job || "COMMUNITY POTENTIAL INTERN").slice(0, 64).toUpperCase(),
    sentence: String(input?.sentence || "Complete eight hours of community potential.").slice(0, 110),
    fine: String(input?.fine || "One sincere apology").slice(0, 64),
  };
}

function renderRuling(ruling) {
  elements.rulingTitle.textContent = ruling.ruling;
  elements.rulingResponse.textContent = `“${ruling.response}”`;
  elements.rulingJob.textContent = ruling.new_job;
  elements.rulingSentence.textContent = ruling.sentence;
  elements.rulingFine.textContent = ruling.fine;
  elements.courtRuling.hidden = false;
  elements.courtRuling.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function openAppeal() {
  if (!currentVerdict) return;
  elements.appealCase.textContent = currentVerdict.caseNumber;
  elements.appealInput.value = currentVerdict.appealText || "This is literally trash.";
  elements.appealSubmit.disabled = false;
  elements.appealSubmit.textContent = "FILE THIS BAD DECISION ↗";
  elements.courtRuling.hidden = !currentVerdict.appealRuling;
  if (currentVerdict.appealRuling) renderRuling(currentVerdict.appealRuling);
  showDialog(elements.appealModal);
  setTimeout(() => elements.appealInput.focus(), 100);
}

async function submitAppeal() {
  if (!currentVerdict || elements.appealSubmit.disabled) return;
  const appeal = elements.appealInput.value.trim() || "This is literally trash.";
  elements.appealSubmit.disabled = true;
  elements.appealSubmit.textContent = "CONSULTING PRECEDENT…";
  const startedAt = performance.now();
  let ruling;

  if (aiConfigured) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7_200);
    try {
      const response = await fetch("/api/appeal", {
        method: "POST",
        headers: buildAiHeaders(),
        body: JSON.stringify({ verdict: currentVerdict, appeal }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) {
        const error = new Error(payload.error || "Court unavailable.");
        error.status = response.status;
        throw error;
      }
      ruling = payload;
    } catch (error) {
      const credentialFailure = handleSessionCredentialError(error, { openDialog: false });
      if (!credentialFailure) {
        console.warn(error);
        showToast("Court Wi-Fi recused itself. Binding local precedent applied.", 3200);
      }
      ruling = localAppeal(currentVerdict);
    } finally {
      clearTimeout(timeout);
    }
  } else {
    ruling = localAppeal(currentVerdict);
  }

  ruling = normalizeRuling(ruling);

  const elapsed = performance.now() - startedAt;
  if (elapsed < 650) await delay(650 - elapsed);
  currentVerdict.appealText = appeal;
  currentVerdict.appealRuling = ruling;
  if (currentVerdict.verdict === "refuse") currentVerdict.potential = Math.max(104, currentVerdict.potential);
  archiveVerdict(currentVerdict);
  renderRuling(ruling);
  elements.appealSubmit.disabled = false;
  elements.appealSubmit.textContent = "RULING ENTERED ✓";
  elements.appealButton.classList.add("has-ruling");
  elements.appealButton.querySelector("b").textContent = ruling.ruling;
  elements.verdictLabel.textContent = `NO CAN DO · ${ruling.ruling}`;
  elements.verdictQuote.textContent = `“${ruling.response}”`;
  elements.speechText.textContent = ruling.response;
  elements.potentialValue.textContent = `${currentVerdict.potential}%`;
  elements.potentialFill.style.width = `${Math.min(100, currentVerdict.potential)}%`;
  speak(ruling.response, currentVerdict.verdict);
  if (currentVerdict.verdict === "refuse" && ruling.ruling.includes("DENIED")) void actuateBin("REJECT");
}

function dictateAppeal() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("This browser has no stenographer. Type your futile appeal instead.", 3600);
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  elements.appealMic.classList.add("is-listening");
  elements.appealMic.textContent = "● LISTENING";
  recognition.onresult = (event) => {
    elements.appealInput.value = event.results[0][0].transcript;
  };
  recognition.onerror = () => showToast("The court reporter objects. Please type it.");
  recognition.onend = () => {
    elements.appealMic.classList.remove("is-listening");
    elements.appealMic.innerHTML = "<span>◉</span> DICTATE";
  };
  recognition.start();
}

function togglePresenterMode() {
  const enabled = document.body.classList.toggle("is-presenter");
  elements.presenterToggle.setAttribute("aria-pressed", String(enabled));
  elements.presenterToggle.querySelector("b").textContent = enabled ? "PRESENTING" : "PRESENTER";
  showToast(enabled ? "Presenter mode: bigger jokes, smaller controls." : "Presenter mode dismissed.");
}

function setReadout(message) {
  elements.cameraReadout.textContent = message;
}

function setState(state) {
  document.body.dataset.state = state;
}

function setMode(mode) {
  if (mode === "live" && !aiConfigured) {
    currentMode = "demo";
    updateLiveAvailability();
    openApiKeySettings();
    showToast("Live AI needs a temporary OpenRouter key. Scripted chaos remains operational.", 5200);
    return false;
  }

  currentMode = mode;
  $$(".mode-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });

  if (mode === "live") {
    showToast("Live AI enabled. Unexpected emotional projections incoming.");
  } else {
    showToast("Scripted mode: three jokes, zero Wi-Fi anxiety.");
  }
  return true;
}

function updateLiveAvailability() {
  elements.liveModeButton.classList.toggle("is-unavailable", !aiConfigured);
  elements.liveModeButton.textContent = aiConfigured ? "LIVE AI" : "LIVE AI · OFFLINE";
  elements.liveModeButton.title = aiConfigured
    ? `Judge an object with live AI vision (${aiModel})`
    : "Add a temporary OpenRouter key here or configure OPENROUTER_API_KEY in Vercel";
  elements.liveWildcard.classList.toggle("is-unavailable", !aiConfigured);
  elements.liveWildcard.title = elements.liveModeButton.title;
  $$(".mode-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === currentMode);
  });
}

async function checkSystemStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    serverAiConfigured = Boolean(status.aiConfigured);
    aiModel = String(status.model || aiModel);
  } catch {
    serverAiConfigured = false;
  }
  renderAiAvailability();

  if (!("serial" in navigator)) {
    elements.serialButton.title = "Web Serial requires Chrome or Edge on localhost/HTTPS.";
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("This browser has camera boundaries. Upload a photo instead.");
    return;
  }

  try {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
      audio: false,
    });
    elements.camera.srcObject = cameraStream;
    await elements.camera.play();
    currentUploadDataUrl = "";
    elements.uploadedPreview.classList.remove("is-visible");
    elements.camera.classList.add("is-visible");
    elements.cameraEmpty.classList.add("is-hidden");
    elements.cameraButton.innerHTML = '<span class="button-icon">◎</span> CAMERA READY';
    setReadout("OBJECT FIELD ACTIVE");
  } catch (error) {
    console.warn(error);
    showToast("Camera said no. Upload a photo—or use the indestructible demo deck.", 3800);
  }
}

async function handleUpload(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Binjamin can only emotionally process images right now.");
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  let source;
  try {
    try {
      source = await createImageBitmap(file);
    } catch {
      source = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Unsupported image format"));
        image.src = objectUrl;
      });
    }

    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    const maxDimension = 1280;
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    elements.snapshot.width = Math.max(1, Math.round(sourceWidth * scale));
    elements.snapshot.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = elements.snapshot.getContext("2d", { alpha: false });
    context.drawImage(source, 0, 0, elements.snapshot.width, elements.snapshot.height);
    currentUploadDataUrl = elements.snapshot.toDataURL("image/jpeg", 0.78);
    elements.uploadedPreview.src = currentUploadDataUrl;
    elements.uploadedPreview.classList.add("is-visible");
    elements.camera.classList.remove("is-visible");
    elements.cameraEmpty.classList.add("is-hidden");
    setReadout("EVIDENCE LOADED");
    showToast("Evidence accepted. Morality pending.");
  } catch (error) {
    console.warn(error);
    showToast("That photo format needs a personality transplant. Try JPEG or PNG.", 3800);
  } finally {
    source?.close?.();
    URL.revokeObjectURL(objectUrl);
  }
}

async function captureFrame() {
  if (currentUploadDataUrl) return currentUploadDataUrl;
  if (!cameraStream || elements.camera.readyState < 2) return "";

  const sourceWidth = elements.camera.videoWidth || 1280;
  const sourceHeight = elements.camera.videoHeight || 960;
  const maxWidth = 960;
  const scale = Math.min(1, maxWidth / sourceWidth);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  const context = elements.snapshot.getContext("2d", { alpha: false });
  elements.snapshot.width = width;
  elements.snapshot.height = height;
  context.drawImage(elements.camera, 0, 0, width, height);
  return elements.snapshot.toDataURL("image/jpeg", 0.78);
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(frequency, startOffset = 0, duration = 0.12, type = "sine", volume = 0.05) {
  if (!soundEnabled) return;
  const context = getAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startsAt = context.currentTime + startOffset;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(0.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(volume, startsAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.02);
}

function playScanSound() {
  tone(310, 0, 0.1, "square", 0.018);
  tone(410, 0.18, 0.1, "square", 0.018);
  tone(510, 0.36, 0.1, "square", 0.018);
}

function playVerdictSound(verdict) {
  if (verdict === "accept") {
    [523, 659, 784, 1047].forEach((note, index) => tone(note, index * 0.1, 0.2, "triangle", 0.06));
  } else {
    tone(180, 0, 0.18, "sawtooth", 0.035);
    tone(138, 0.2, 0.28, "sawtooth", 0.035);
  }
}

function chooseVoice() {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const preferredNames = ["Daniel", "Eddy", "Reed", "Google UK English Male", "Samantha"];
  return (
    preferredNames.map((name) => voices.find((voice) => voice.name.includes(name))).find(Boolean) ||
    voices.find((voice) => voice.lang.startsWith("en"))
  );
}

function speak(text, verdict) {
  if (!soundEnabled || !("speechSynthesis" in window)) return;
  clearTimeout(speechTimer);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = chooseVoice();
  utterance.rate = verdict === "accept" ? 0.88 : 0.92;
  utterance.pitch = verdict === "accept" ? 0.67 : 0.78;
  utterance.volume = 1;
  speechTimer = setTimeout(() => {
    speechTimer = undefined;
    if (soundEnabled) window.speechSynthesis.speak(utterance);
  }, 90);
}

function normalizeVerdict(verdict) {
  return {
    object_name: String(verdict.object_name || "MYSTERY OBJECT").slice(0, 42).toUpperCase(),
    reframe_name: String(verdict.reframe_name || "UNREALIZED POTENTIAL").slice(0, 42).toUpperCase(),
    headline: String(verdict.headline || "DISPOSAL DENIED").slice(0, 48).toUpperCase(),
    monologue: String(verdict.monologue || "I have seen enough. This object has a future.").slice(0, 260),
    verdict: verdict.verdict === "accept" ? "accept" : "refuse",
    potential: Math.max(0, Math.min(100, Number(verdict.potential) || 0)),
    footnote: String(verdict.footnote || "Assessment emotionally binding.").slice(0, 100),
  };
}

async function presentVerdict(input) {
  const verdict = {
    ...normalizeVerdict(input),
    caseNumber: makeCaseNumber(),
    createdAt: new Date().toISOString(),
  };
  currentVerdict = verdict;
  archiveVerdict(verdict);
  elements.appealButton.classList.remove("has-ruling");
  elements.appealButton.querySelector("b").textContent = "BUT IT'S LITERALLY TRASH";
  document.body.dataset.verdict = verdict.verdict;
  elements.verdictLabel.textContent = verdict.headline;
  elements.verdictSymbol.textContent = verdict.verdict === "accept" ? "✓" : "✦";
  elements.objectName.textContent = verdict.object_name;
  elements.reframeName.textContent = verdict.reframe_name;
  elements.verdictQuote.textContent = `“${verdict.monologue}”`;
  elements.potentialValue.textContent = `${verdict.potential}%`;
  elements.verdictFootnote.textContent = `* ${verdict.footnote}`;
  elements.speechText.textContent = verdict.monologue;
  elements.moodChip.lastChild.textContent = verdict.verdict === "accept" ? " BRUTALLY AVAILABLE" : " EMOTIONALLY AVAILABLE";

  elements.potentialFill.style.width = "0%";
  setState("result");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      elements.potentialFill.style.width = `${verdict.potential}%`;
    });
  });

  if (verdict.verdict === "refuse") {
    elements.binjamin.classList.remove("is-rejecting");
    void elements.binjamin.offsetWidth;
    elements.binjamin.classList.add("is-rejecting");
  }

  setReadout(verdict.verdict === "accept" ? "ACTUAL GARBAGE CONFIRMED" : "HIDDEN POTENTIAL CONFIRMED");
  elements.judgeButtonLabel.textContent = "JUDGE ANOTHER OBJECT";
  elements.judgeButton.disabled = false;
  isBusy = false;
  playVerdictSound(verdict.verdict);
  speak(verdict.monologue, verdict.verdict);
  if (verdict.verdict === "accept") launchConfetti();
  if (hardwareCuesSupported) void sendSerial(verdict.verdict === "accept" ? "CUE ACCEPT" : "CUE REFUSE");
  void actuateBin(verdict.verdict === "accept" ? "OPEN" : "REJECT");
}

function resetExperience() {
  clearTimeout(speechTimer);
  speechTimer = undefined;
  window.speechSynthesis?.cancel();
  delete document.body.dataset.manualLid;
  elements.binjamin.classList.remove("is-rejecting");
  elements.speechText.textContent = "Show me what society gave up on.";
  elements.judgeButtonLabel.textContent = "ASK BINJAMIN";
  elements.potentialFill.style.width = "0%";
  setReadout(cameraStream || currentUploadDataUrl ? "OBJECT FIELD ACTIVE" : "NO OBJECT DETECTED");
  if (!cameraStream && !currentUploadDataUrl) {
    elements.emptyPlus.textContent = "+";
    elements.cameraEmptyCopy.innerHTML = "BINJAMIN REQUIRES<br>VISUAL EVIDENCE";
  }
  if (hardwareCuesSupported) void sendSerial("CUE IDLE");
  setState("idle");
}

async function enterScanningState() {
  isBusy = true;
  elements.judgeButton.disabled = true;
  elements.judgeButtonLabel.textContent = "ASSESSING VIBES…";
  elements.speechText.textContent = "Please remain still while I project onto this object.";
  setReadout("SCANNING FOR UNREALIZED POTENTIAL");
  setState("scanning");
  playScanSound();
  if (hardwareCuesSupported) void sendSerial("CUE SCAN");
}

function nextDemoKey() {
  const order = ["banana", "resume", "iphone"];
  const key = order[demoIndex % order.length];
  demoIndex += 1;
  return key;
}

function showManualEvidence(key) {
  if (cameraStream || currentUploadDataUrl) return;
  const evidence = DEMO_EVIDENCE[key] || DEMO_EVIDENCE.random;
  elements.emptyPlus.textContent = evidence.icon;
  elements.cameraEmptyCopy.innerHTML = evidence.label.replace("\n", "<br>");
  setReadout("MANUAL EVIDENCE ACCEPTED");
}

async function runDemo(requestedKey) {
  if (serialState === "ready" && serialLidState === "open") {
    showToast("Binjamin is still open. Clear the opening and press C before the next case.", 4800);
    return;
  }
  if (isBusy) {
    if (!requestedKey || !activeLiveController) return;
    activeLiveController.abort();
    activeLiveController = undefined;
    runGeneration += 1;
    isBusy = false;
    showToast("Live testimony overruled. Scripted precedent entering the record.", 2800);
  }
  const runId = ++runGeneration;
  const key = requestedKey || nextDemoKey();
  if (requestedKey && ["banana", "resume", "iphone"].includes(requestedKey)) {
    demoIndex = ["banana", "resume", "iphone"].indexOf(requestedKey) + 1;
  }
  resetExperience();
  showManualEvidence(key);
  await enterScanningState();
  const verdict = key === "random"
    ? CHAOS_VERDICTS[Math.floor(Math.random() * CHAOS_VERDICTS.length)]
    : DEMO_VERDICTS[key] || DEMO_VERDICTS.banana;
  const scanTime = key === "iphone" ? 1150 : 1450;
  if (key === "iphone") {
    elements.speechText.textContent = "Lightning port detected. Searching for future potential…";
    setReadout("LIGHTNING PORT DETECTED");
  }
  await delay(scanTime);
  if (runId !== runGeneration) return;
  if (key === "iphone") {
    const setup = "An iPhone with a Lightning port?";
    elements.speechText.textContent = setup;
    setReadout("OBSOLESCENCE CONFIDENCE: RISING");
    speak(setup, "accept");
    await delay(1250);
    if (runId !== runGeneration) return;
  }
  await presentVerdict(verdict);
}

async function runLiveJudgment() {
  if (isBusy) return;
  if (!aiConfigured) {
    setMode("live");
    return;
  }
  if (serialState === "ready" && serialLidState === "open") {
    showToast("Close the lid before convening another hearing. Safety has standing.", 4600);
    return;
  }
  const image = await captureFrame();
  if (!image) {
    showToast("Binjamin needs visual evidence. Starting camera…", 2500);
    await startCamera();
    return;
  }

  resetExperience();
  const runId = ++runGeneration;
  await enterScanningState();
  const startedAt = performance.now();
  const controller = new AbortController();
  activeLiveController = controller;
  const timeout = setTimeout(() => controller.abort(), 7_200);

  try {
    const response = await fetch("/api/judge", {
      method: "POST",
      headers: buildAiHeaders(),
      body: JSON.stringify({ image, hint: elements.hint.value.trim() }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error || "Live judgment unavailable.");
      error.status = response.status;
      throw error;
    }
    const elapsed = performance.now() - startedAt;
    if (elapsed < 1350) await delay(1350 - elapsed);
    if (runId !== runGeneration) return;
    await presentVerdict(payload);
  } catch (error) {
    if (runId !== runGeneration) return;
    if (handleSessionCredentialError(error)) {
      recoverLiveControls();
      return;
    }
    console.warn(error);
    const fallback = elements.hint.value.toLowerCase().includes("phone")
      ? DEMO_VERDICTS.iphone
      : MYSTERY_VERDICT;
    showToast("Cloud confidence collapsed. Local audacity has taken over.", 3400);
    await delay(450);
    if (runId !== runGeneration) return;
    await presentVerdict(fallback);
  } finally {
    clearTimeout(timeout);
    if (activeLiveController === controller) activeLiveController = undefined;
  }
}

async function handleJudgeClick() {
  if (isBusy) return;
  if (serialState === "ready" && serialLidState === "open") {
    showToast("Clear the opening and press C to close the lid before judging again.", 4800);
    return;
  }
  if (document.body.dataset.state === "result") {
    resetExperience();
    await delay(180);
  }
  if (currentMode === "live") await runLiveJudgment();
  else await runDemo();
}

function updateSerialUi(state) {
  serialState = state;
  const label = elements.serialButton.querySelector("b");
  elements.hardwareStatus.classList.toggle("is-connected", state === "ready");
  if (state === "connecting") {
    label.textContent = "ARMING…";
    elements.hardwareStatus.innerHTML = "<i></i>MOTOR: VERIFYING BOUNDARIES";
  } else if (state === "ready") {
    label.textContent = "DISCONNECT BIN";
    elements.hardwareStatus.innerHTML = "<i></i>MOTOR: ARMED & OPINIONATED";
  } else {
    label.textContent = "CONNECT BIN";
    elements.hardwareStatus.innerHTML = "<i></i>MOTOR: DRAMATIC REENACTMENT";
  }
}

function rejectSerialWaiters(error) {
  while (serialWaiters.length) {
    const waiter = serialWaiters.shift();
    clearTimeout(waiter.timer);
    waiter.reject(error);
  }
}

function waitForSerialLine(expected, timeoutMs = 2400) {
  return new Promise((resolve, reject) => {
    const waiter = { expected, resolve, reject, timer: undefined };
    waiter.timer = setTimeout(() => {
      const index = serialWaiters.indexOf(waiter);
      if (index >= 0) serialWaiters.splice(index, 1);
      reject(new Error(`Motor did not answer ${expected}.`));
    }, timeoutMs);
    serialWaiters.push(waiter);
  });
}

function handleSerialLine(line) {
  if (!line) return;
  if (line === "WARN LID OPEN") {
    showToast("Binjamin is experiencing boundary fatigue—clear the opening and press C.", 5200);
    return;
  }
  if (line.startsWith("ERR")) {
    const waiter = serialWaiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(line));
    }
    showToast(`Motor says: ${line.replace("ERR ", "")}`, 3200);
    return;
  }

  const index = serialWaiters.findIndex((waiter) => waiter.expected === line);
  if (index >= 0) {
    const [waiter] = serialWaiters.splice(index, 1);
    clearTimeout(waiter.timer);
    waiter.resolve(line);
  }
}

async function readSerialLoop(port) {
  const reader = port.readable.getReader();
  serialReader = reader;
  const decoder = new TextDecoder();
  try {
    while (port === serialPort) {
      const { value, done } = await reader.read();
      if (done) break;
      serialReadBuffer += decoder.decode(value, { stream: true });
      const lines = serialReadBuffer.split(/\r?\n/);
      serialReadBuffer = lines.pop() || "";
      lines.forEach((line) => handleSerialLine(line.trim()));
    }
  } catch (error) {
    if (port === serialPort && serialState !== "disconnecting") console.warn(error);
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
    if (serialReader === reader) serialReader = undefined;
    if (port === serialPort && serialState !== "disconnecting") {
      void disconnectSerial({ closePort: false, message: "USB connection ended. Digital stunt double active." });
    }
  }
}

async function writeSerialRaw(command) {
  if (!serialWriter) throw new Error("Motor writer is unavailable.");
  await serialWriter.write(new TextEncoder().encode(`${command}\n`));
}

async function writeSerialAndWait(command, expected, timeoutMs) {
  const acknowledged = waitForSerialLine(expected, timeoutMs);
  try {
    await writeSerialRaw(command);
  } catch (error) {
    rejectSerialWaiters(error);
    await acknowledged.catch(() => {});
    throw error;
  }
  return acknowledged;
}

async function disconnectSerial({ closePort = true, message = "Motor safely disarmed." } = {}) {
  if (serialState === "disconnected" && !serialPort) return;
  serialState = "disconnecting";
  const port = serialPort;
  serialPort = undefined;
  rejectSerialWaiters(new Error("Motor disconnected."));

  const reader = serialReader;
  serialReader = undefined;
  if (reader) {
    try { await reader.cancel(); } catch { /* device already gone */ }
    try { reader.releaseLock(); } catch { /* read loop released it */ }
  }
  if (serialWriter) {
    try { serialWriter.releaseLock(); } catch { /* device already gone */ }
    serialWriter = undefined;
  }
  if (closePort && port) {
    try { await port.close(); } catch { /* device already gone */ }
  }

  serialReadBuffer = "";
  hardwareCuesSupported = false;
  clearTimeout(serialOpenWarningTimer);
  serialOpenWarningTimer = undefined;
  updateSerialUi("disconnected");
  if (message) showToast(message);
}

async function connectSerial() {
  if (!("serial" in navigator)) {
    showToast("Motor connection needs Chrome or Edge. Dramatic reenactment remains flawless.", 4200);
    return;
  }
  if (serialState === "connecting" || serialState === "disconnecting") return;
  if (serialState === "ready") {
    if (serialLidState === "open") {
      showToast("Clear the opening and press C to close the lid before disconnecting.", 4800);
      return;
    }
    const disarmed = await sendSerial("DISARM");
    if (disarmed) await disconnectSerial();
    else showToast("Binjamin refused to disarm. Keep USB connected, press C, then retry.", 5200);
    return;
  }

  if (!serialSafetyPrimed) {
    serialSafetyPrimed = true;
    elements.serialButton.querySelector("b").textContent = "LID CLEAR? CLICK AGAIN";
    showToast("Safety check: manually close the lid, clear the linkage, then click Connect again.", 6500);
    clearTimeout(serialSafetyTimer);
    serialSafetyTimer = setTimeout(() => {
      serialSafetyPrimed = false;
      if (serialState === "disconnected") updateSerialUi("disconnected");
    }, 8000);
    return;
  }

  serialSafetyPrimed = false;
  clearTimeout(serialSafetyTimer);
  updateSerialUi("connecting");
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    serialPort = port;
    serialWriter = port.writable.getWriter();
    void readSerialLoop(port);

    await delay(1250);
    await writeSerialAndWait("PING", "READY", 3000);
    await writeSerialAndWait("ARM", "OK ARMED", 1800);

    updateSerialUi("ready");
    serialLidState = "closed";
    hardwareCuesSupported = await sendSerial("CUE IDLE");
    showToast("Binjamin is armed. Keep the foam lid's path clear.", 3800);
  } catch (error) {
    console.warn(error);
    await disconnectSerial({ message: "Motor handshake failed. CSS stunt double reporting for duty." });
  }
}

function handleSerialDisconnect(event) {
  if (event?.target && serialPort && event.target !== serialPort) return;
  void disconnectSerial({ closePort: false, message: "USB unplugged. Binjamin is dissociating digitally." });
}

async function sendSerial(command) {
  if (serialState !== "ready" || !serialWriter) return false;
  const expected = {
    OPEN: "OK OPEN",
    CLOSE: "OK CLOSED",
    REJECT: "OK REJECT",
    DISARM: "OK DISARMED",
    "CUE IDLE": "OK CUE IDLE",
    "CUE SCAN": "OK CUE SCAN",
    "CUE REFUSE": "OK CUE REFUSE",
    "CUE ACCEPT": "OK CUE ACCEPT",
    "CUE OFF": "OK CUE OFF",
    "MUTE ON": "OK MUTE ON",
    "MUTE OFF": "OK MUTE OFF",
  }[command];
  if (!expected) return false;

  const operation = serialWriteQueue.then(async () => {
    await writeSerialAndWait(command, expected, 2200);
    return true;
  });
  serialWriteQueue = operation.catch(() => {});

  try {
    const succeeded = await operation;
    if (command === "OPEN") {
      serialLidState = "open";
      clearTimeout(serialOpenWarningTimer);
      serialOpenWarningTimer = setTimeout(() => {
        showToast("Lid still open—clear the opening and press C. It will never auto-close.", 5200);
      }, 10_000);
    }
    if (command === "CLOSE" || command === "REJECT") {
      serialLidState = "closed";
      clearTimeout(serialOpenWarningTimer);
      serialOpenWarningTimer = undefined;
    }
    return succeeded;
  } catch (error) {
    console.warn(error);
    if (String(error.message).startsWith("ERR")) return false;
    await disconnectSerial({ message: "Motor stopped answering. Dramatic reenactment resumed." });
    return false;
  }
}

async function actuateBin(command) {
  if (command === "OPEN") {
    document.body.dataset.manualLid = "open";
  } else if (command === "CLOSE") {
    delete document.body.dataset.manualLid;
    document.body.dataset.verdict = "refuse";
  } else if (command === "REJECT") {
    delete document.body.dataset.manualLid;
    elements.binjamin.classList.remove("is-rejecting");
    void elements.binjamin.offsetWidth;
    elements.binjamin.classList.add("is-rejecting");
  }
  return sendSerial(command);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  elements.soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  elements.soundToggle.querySelector("b").textContent = soundEnabled ? "SOUND ON" : "SOUND OFF";
  elements.soundToggle.querySelector("span").textContent = soundEnabled ? "◖))" : "◖×";
  if (!soundEnabled) {
    clearTimeout(speechTimer);
    speechTimer = undefined;
    window.speechSynthesis?.cancel();
  }
  else tone(523, 0, 0.12, "triangle", 0.04);
  if (hardwareCuesSupported) void sendSerial(soundEnabled ? "MUTE OFF" : "MUTE ON");
}

function handleKeyboard(event) {
  const interactiveTarget = event.target instanceof Element
    && event.target.closest("input, textarea, button, select, a, [contenteditable='true']");
  if (interactiveTarget || $("dialog[open]") || event.metaKey || event.ctrlKey || event.altKey) return;
  const demoKeys = { "1": "banana", "2": "resume", "3": "iphone", "4": "random" };
  if (demoKeys[event.key]) {
    event.preventDefault();
    void runDemo(demoKeys[event.key]);
    return;
  }
  if (event.key.toLowerCase() === "l") {
    event.preventDefault();
    if (!setMode("live")) return;
    void runLiveJudgment();
    return;
  }
  if (event.key.toLowerCase() === "p") {
    event.preventDefault();
    togglePresenterMode();
    return;
  }
  if (event.key.toLowerCase() === "a" && currentVerdict && document.body.dataset.state === "result") {
    event.preventDefault();
    openAppeal();
    return;
  }
  if (event.key.toLowerCase() === "h") {
    event.preventDefault();
    openHall();
    return;
  }
  if (event.key === " ") {
    event.preventDefault();
    void handleJudgeClick();
    return;
  }
  const hardwareKeys = { o: "OPEN", c: "CLOSE", r: "REJECT" };
  const command = hardwareKeys[event.key.toLowerCase()];
  if (command) {
    event.preventDefault();
    void actuateBin(command);
    showToast(`${command}: manual emotional override`);
  }
}

elements.cameraButton.addEventListener("click", startCamera);
elements.fileInput.addEventListener("change", (event) => handleUpload(event.target.files?.[0]));
elements.judgeButton.addEventListener("click", handleJudgeClick);
elements.apiKeyButton.addEventListener("click", () => openApiKeySettings());
elements.apiKeyForm.addEventListener("submit", saveSessionOpenRouterKey);
elements.apiKeyReveal.addEventListener("click", toggleApiKeyReveal);
elements.apiKeyClear.addEventListener("click", () => clearSessionOpenRouterKey());
elements.apiKeyInput.addEventListener("input", () => {
  if (elements.apiKeyStatus.classList.contains("is-error")) {
    setApiKeyStatus("READY TO INSPECT A NEW KEY");
  }
});
elements.apiKeyModal.addEventListener("close", () => {
  elements.apiKeyInput.value = "";
  resetApiKeyReveal();
  if (apiKeyReturnFocus?.isConnected) apiKeyReturnFocus.focus();
  apiKeyReturnFocus = undefined;
});
elements.appealButton.addEventListener("click", openAppeal);
elements.appealMic.addEventListener("click", dictateAppeal);
elements.appealSubmit.addEventListener("click", submitAppeal);
elements.certificateButton.addEventListener("click", openCertificate);
elements.printCertificate.addEventListener("click", () => window.print());
elements.hallButton.addEventListener("click", openHall);
elements.resultHallButton.addEventListener("click", openHall);
elements.clearHistory.addEventListener("click", () => {
  verdictHistory = [];
  persistHistory();
  renderHistory();
  showToast("Public records shredded. Accountability has left the building.");
});
elements.presenterToggle.addEventListener("click", togglePresenterMode);
elements.liveWildcard.addEventListener("click", () => {
  if (!setMode("live")) return;
  void runLiveJudgment();
});
elements.soundToggle.addEventListener("click", toggleSound);
elements.serialButton.addEventListener("click", connectSerial);
elements.dockToggle.addEventListener("click", () => {
  const isClosed = elements.dock.classList.toggle("is-closed");
  elements.dockToggle.setAttribute("aria-expanded", String(!isClosed));
});

$$('.mode-button').forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

$$('.prop-button').forEach((button) => {
  if (!button.dataset.demo) return;
  button.addEventListener("click", () => runDemo(button.dataset.demo));
});

$$('[data-close-dialog]').forEach((button) => {
  button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog)?.close());
});

document.addEventListener("keydown", handleKeyboard);
if ("serial" in navigator) navigator.serial.addEventListener("disconnect", handleSerialDisconnect);
window.addEventListener("beforeunload", () => {
  sessionOpenRouterKey = "";
  elements.apiKeyInput.value = "";
  cameraStream?.getTracks().forEach((track) => track.stop());
});
window.addEventListener("pagehide", () => {
  sessionOpenRouterKey = "";
  elements.apiKeyInput.value = "";
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  if (!serverAiConfigured) currentMode = "demo";
  elements.apiKeyStatus.classList.remove("is-error");
  resetApiKeyReveal();
  renderAiAvailability();
});

renderHistory();
checkSystemStatus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Offline rehearsal unavailable", error));
  });
}
