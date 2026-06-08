import { Application } from "pixi.js";
import { loadPetIds, loadPetPackage } from "./pet-loader";
import { PetPlayer } from "./pet-player";
import type { AnimationId, PetLines, PetManifest } from "./types";
import "./styles.css";

const stageHost = requiredElement<HTMLDivElement>("#pet-stage");
const petSelect = requiredElement<HTMLSelectElement>("#pet-select");
const scaleSelect = requiredElement<HTMLSelectElement>("#scale-select");
const bubble = requiredElement<HTMLDivElement>("#speech-bubble");
const dock = requiredElement<HTMLDivElement>("#pet-dock");
const quitButton = requiredElement<HTMLButtonElement>("#quit-button");

const SETTINGS_KEY = "deskpet:settings:v1";
const DEFAULT_USER_SCALE = 1;
const DOCK_MARGIN = 8;

interface WindowPosition {
  x: number;
  y: number;
}

interface DeskPetSettings {
  petId?: string;
  scale?: number;
  windowPosition?: WindowPosition;
}

const app = new Application<HTMLCanvasElement>({
  backgroundAlpha: 0,
  antialias: false,
  autoDensity: true,
  resolution: window.devicePixelRatio,
  resizeTo: window,
});

stageHost.appendChild(app.view);

const player = new PetPlayer(app);
let debugHitboxEnabled = isDebugHitboxEnabled();
player.setDebugHitboxEnabled(debugHitboxEnabled);
let activeManifest: PetManifest | undefined;
let activeLines: PetLines = {};
let bubbleTimer: number | undefined;
let pointerStart: { x: number; y: number } | undefined;
let dragStarted = false;

void bootstrap().catch((error) => {
  console.warn(error);
  showStatusLine("宠物加载失败，请检查资源文件。");
});

function requiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`DeskPet DOM mount point is missing: ${selector}`);
  }

  return element;
}

async function bootstrap(): Promise<void> {
  const settings = loadSettings();
  const petIds = await loadPetIds();

  if (!petIds.length) {
    throw new Error("DeskPet pet index is empty");
  }

  for (const id of petIds) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    petSelect.appendChild(option);
  }

  const initialPetId = settings.petId && petIds.includes(settings.petId) ? settings.petId : petIds[0];
  const initialScale = resolveScale(settings.scale);

  player.setUserScale(initialScale);
  setScaleSelectValue(initialScale);

  if (settings.windowPosition) {
    void restoreNativeWindowPosition(settings.windowPosition);
  }

  await setActivePet(initialPetId);
  bindEvents();
}

async function setActivePet(id: string): Promise<void> {
  const petPackage = await loadPetPackage(id);
  activeManifest = petPackage.manifest;
  activeLines = petPackage.lines;

  const option = Array.from(petSelect.options).find((item) => item.value === id);
  if (option) {
    option.textContent = activeManifest.name;
  }

  petSelect.value = id;
  await player.load(activeManifest);
  showLine("idle");
}

function bindEvents(): void {
  petSelect.addEventListener("change", () => {
    void handlePetSelectChange();
  });

  scaleSelect.addEventListener("change", () => {
    const scale = resolveScale(Number(scaleSelect.value));
    player.setUserScale(scale);
    setScaleSelectValue(scale);
    saveSettings({ scale });
  });

  quitButton.addEventListener("click", () => {
    void quitApp();
  });

  dock.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-action]") : undefined;
    const action = target?.dataset.action as AnimationId | undefined;

    if (action) {
      playWithLine(action);
    }
  });

  document.addEventListener(
    "pointerdown",
    (event) => {
      handlePetPress(event.button, event.clientX, event.clientY, event.target, event);
    },
    true,
  );

  document.addEventListener(
    "mousedown",
    (event) => {
      handlePetPress(event.button, event.clientX, event.clientY, event.target, event);
    },
    true,
  );

  window.addEventListener("pointermove", (event) => {
    handlePetMove(event.clientX, event.clientY);
  });

  window.addEventListener("mousemove", (event) => {
    handlePetMove(event.clientX, event.clientY);
  });

  window.addEventListener("pointerup", () => {
    handlePetRelease();
  });

  window.addEventListener("mouseup", () => {
    handlePetRelease();
  });

  window.addEventListener("resize", () => player.layout());

  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "h") {
      event.preventDefault();
      toggleDebugHitbox();
    }
  });

  document.addEventListener(
    "contextmenu",
    (event) => {
      if (event.target instanceof Node && dock.contains(event.target)) {
        return;
      }

      event.preventDefault();

      if (!player.containsClientPoint(event.clientX, event.clientY)) {
        return;
      }

      openDockAt(event.clientX, event.clientY);
    },
    true,
  );
}

function handlePetPress(
  button: number,
  clientX: number,
  clientY: number,
  target: EventTarget | null,
  event: Event,
): void {
  if (target instanceof Node && dock.contains(target)) {
    return;
  }

  if (!player.containsClientPoint(clientX, clientY)) {
    pointerStart = undefined;
    dragStarted = false;
    closeDock();
    return;
  }

  if (dock.classList.contains("is-open")) {
    closeDock();
  }

  if (button === 2) {
    event.preventDefault();
    openDockAt(clientX, clientY);
    return;
  }

  if (button !== 0) {
    return;
  }

  pointerStart = { x: clientX, y: clientY };
  dragStarted = false;
}

function handlePetMove(clientX: number, clientY: number): void {
  if (!pointerStart || dragStarted) {
    return;
  }

  const moved = Math.abs(clientX - pointerStart.x) + Math.abs(clientY - pointerStart.y);

  if (moved > 8) {
    dragStarted = true;
    playWithLine("drag");
    void startNativeWindowDrag();
  }
}

function handlePetRelease(): void {
  if (!pointerStart) {
    return;
  }

  const wasDragging = dragStarted;

  if (wasDragging) {
    playWithLine("drop");
    window.setTimeout(() => void saveNativeWindowPosition(), 150);
  } else {
    playWithLine("touch");
  }

  pointerStart = undefined;
  dragStarted = false;
}

async function handlePetSelectChange(): Promise<void> {
  const petId = petSelect.value;

  if (!petId) {
    return;
  }

  try {
    await setActivePet(petId);
    saveSettings({ petId });
  } catch (error) {
    console.warn(error);
    showStatusLine("宠物切换失败，请检查资源文件。");
  }
}

function openDockAt(clientX: number, clientY: number): void {
  dock.classList.add("is-open");

  const dockWidth = dock.offsetWidth;
  const dockHeight = dock.offsetHeight;
  const x = Math.max(DOCK_MARGIN, Math.min(clientX, window.innerWidth - dockWidth - DOCK_MARGIN));
  const y = Math.max(DOCK_MARGIN, Math.min(clientY, window.innerHeight - dockHeight - DOCK_MARGIN));

  dock.style.setProperty("--dock-x", `${x}px`);
  dock.style.setProperty("--dock-y", `${y}px`);
}

function closeDock(): void {
  dock.classList.remove("is-open");
}

async function startNativeWindowDrag(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startDragging().catch(() => undefined);
}

async function saveNativeWindowPosition(): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const position = await getCurrentWindow().outerPosition().catch(() => undefined);

  if (position) {
    saveSettings({ windowPosition: { x: position.x, y: position.y } });
  }
}

async function restoreNativeWindowPosition(position: WindowPosition): Promise<void> {
  if (!isTauri()) {
    return;
  }

  const [{ getCurrentWindow }, { PhysicalPosition }] = await Promise.all([
    import("@tauri-apps/api/window"),
    import("@tauri-apps/api/dpi"),
  ]);

  await getCurrentWindow()
    .setPosition(new PhysicalPosition(position.x, position.y))
    .catch(() => undefined);
}

async function quitApp(): Promise<void> {
  await saveNativeWindowPosition();

  if (!isTauri()) {
    window.close();
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close().catch(() => undefined);
}

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function isDebugHitboxEnabled(): boolean {
  try {
    const value = new URLSearchParams(window.location.search).get("debugHitbox") ?? localStorage.getItem("deskpet:debugHitbox");
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

function toggleDebugHitbox(): void {
  debugHitboxEnabled = !debugHitboxEnabled;
  player.setDebugHitboxEnabled(debugHitboxEnabled);

  try {
    localStorage.setItem("deskpet:debugHitbox", debugHitboxEnabled ? "1" : "0");
  } catch {
    // Ignore persistence failures so debug mode stays best-effort.
  }

  showStatusLine(debugHitboxEnabled ? "Hitbox 调试已开启" : "Hitbox 调试已关闭");
}

function playWithLine(animationId: AnimationId): void {
  player.play(animationId);
  showLine(animationId);
}

function showLine(animationId: AnimationId): void {
  const lines = activeLines[animationId];
  const text = lines?.length ? lines[Math.floor(Math.random() * lines.length)] : "";

  if (!text) {
    showStatusLine("");
    return;
  }

  showStatusLine(text);
}

function showStatusLine(text: string): void {
  window.clearTimeout(bubbleTimer);

  if (!text) {
    bubble.classList.remove("is-visible");
    bubble.textContent = "";
    return;
  }

  bubble.textContent = text;
  bubble.classList.add("is-visible");
  bubbleTimer = window.setTimeout(() => {
    bubble.classList.remove("is-visible");
  }, 2600);
}

function loadSettings(): DeskPetSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!isRecord(parsed)) {
      return {};
    }

    const settings: DeskPetSettings = {};

    if (typeof parsed.petId === "string") {
      settings.petId = parsed.petId;
    }

    if (isFiniteNumber(parsed.scale)) {
      settings.scale = parsed.scale;
    }

    if (isRecord(parsed.windowPosition)) {
      const { x, y } = parsed.windowPosition;

      if (isFiniteNumber(x) && isFiniteNumber(y)) {
        settings.windowPosition = { x, y };
      }
    }

    return settings;
  } catch {
    return {};
  }
}

function saveSettings(patch: Partial<DeskPetSettings>): void {
  try {
    const next = { ...loadSettings(), ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore persistence failures so the pet keeps running.
  }
}

function resolveScale(scale: unknown): number {
  if (!isFiniteNumber(scale)) {
    return DEFAULT_USER_SCALE;
  }

  const allowed = Array.from(scaleSelect.options).map((option) => Number(option.value));
  return allowed.includes(scale) ? scale : DEFAULT_USER_SCALE;
}

function setScaleSelectValue(scale: number): void {
  scaleSelect.value = String(scale);

  if (scaleSelect.value !== String(scale)) {
    scaleSelect.value = String(DEFAULT_USER_SCALE);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
