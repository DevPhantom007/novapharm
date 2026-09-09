import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { localCatalog } from "./localCatalog.js";

const LOCAL_DATA_VERSION = 1;
const localDataPath = () => process.env.NOVA_LOCAL_DATA_PATH || path.resolve(process.cwd(), "data", "nova-local-data.json");
const localImageDirectory = () => path.join(path.dirname(localDataPath()), "images");
const builtInCatalogById = new Map(localCatalog.map((product) => [product.id, product]));

let cachedState = null;
let writeQueue = Promise.resolve();

function isLocalMode() {
  return !process.env.MONGODB_URI && !process.env.DATABASE_URL;
}

function clone(value) {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function productIdentity(product) {
  const normalize = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  return `${normalize(product.nameHy || product.nameRu || product.nameEn)}|${normalize(product.unit)}`;
}

function createInitialState() {
  const timestamp = now();
  return {
    version: LOCAL_DATA_VERSION,
    sessionSigningSecret: randomBytes(48).toString("hex"),
    products: localCatalog.map((product) => ({
      ...clone(product),
      createdAt: timestamp,
      updatedAt: timestamp
    })),
    orders: [],
    staffAccounts: [],
    settings: {},
    counters: {
      product: localCatalog.reduce((highest, product) => Math.max(highest, product.id), 0) + 1,
      order: 70001,
      staff: 1
    }
  };
}

function normalizeState(value) {
  const initial = createInitialState();
  if (!value || typeof value !== "object") return initial;
  const storedProducts = Array.isArray(value.products) ? value.products : initial.products;
  const products = storedProducts.map((product) => {
    const builtInProduct = builtInCatalogById.get(product?.id);
    if (!builtInProduct || typeof product?.image === "string" && product.image.trim()) return product;
    return { ...product, image: builtInProduct.image };
  });

  return {
    ...initial,
    ...value,
    version: LOCAL_DATA_VERSION,
    sessionSigningSecret: typeof value.sessionSigningSecret === "string" && value.sessionSigningSecret.length >= 32
      ? value.sessionSigningSecret
      : initial.sessionSigningSecret,
    products,
    orders: Array.isArray(value.orders) ? value.orders : [],
    staffAccounts: Array.isArray(value.staffAccounts) ? value.staffAccounts : [],
    settings: value.settings && typeof value.settings === "object" ? value.settings : {},
    counters: {
      ...initial.counters,
      ...(value.counters && typeof value.counters === "object" ? value.counters : {})
    }
  };
}

async function persistState() {
  if (!cachedState) return;
  const target = localDataPath();
  const directory = path.dirname(target);
  const temp = `${target}.${process.pid}.tmp`;

  writeQueue = writeQueue.then(async () => {
    await mkdir(directory, { recursive: true });
    await writeFile(temp, `${JSON.stringify(cachedState, null, 2)}\n`, "utf8");
    await rename(temp, target);
  });

  return writeQueue;
}

async function getLocalState() {
  if (!isLocalMode()) throw new Error("Local data is only available when MONGODB_URI is not configured");
  if (cachedState) return cachedState;

  try {
    const raw = await readFile(localDataPath(), "utf8");
    const savedState = JSON.parse(raw);
    cachedState = normalizeState(savedState);
    const needsCatalogVisualMigration = Array.isArray(savedState.products) && savedState.products.some((product) => {
      const builtInProduct = builtInCatalogById.get(product?.id);
      return builtInProduct && !(typeof product?.image === "string" && product.image.trim());
    });
    if (needsCatalogVisualMigration) await persistState();
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[Local data] Existing file could not be read; a new local-only store will be created.");
    }
    cachedState = createInitialState();
    await persistState();
  }

  return cachedState;
}

async function getLocalSessionSigningSecret() {
  const state = await getLocalState();
  return state.sessionSigningSecret;
}

async function listLocalProducts() {
  const state = await getLocalState();
  const rows = state.products
    .filter((product) => product.archived !== 1)
    .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));
  const deduplicated = new Map();
  for (const product of rows) {
    const key = productIdentity(product);
    const existing = deduplicated.get(key);
    if (!existing) {
      deduplicated.set(key, { ...product });
      continue;
    }
    for (const field of ["nameRu", "nameEn", "descriptionHy", "descriptionRu", "descriptionEn", "image", "sku"]) {
      if (!existing[field] && product[field]) existing[field] = product[field];
    }
    if (existing.outOfStock && !product.outOfStock) existing.outOfStock = 0;
  }
  return clone([...deduplicated.values()]);
}

async function getLocalProductById(id) {
  const state = await getLocalState();
  const product = state.products.find((entry) => entry.id === id);
  return product ? clone(product) : undefined;
}

async function createLocalProduct(product) {
  const state = await getLocalState();
  const id = state.counters.product++;
  const timestamp = now();
  state.products.push({ id, ...clone(product), createdAt: timestamp, updatedAt: timestamp });
  await persistState();
  return id;
}

async function updateLocalProduct(id, updates) {
  const state = await getLocalState();
  const product = state.products.find((entry) => entry.id === id);
  if (!product) throw new Error("Ապրանքը չի գտնվել");
  Object.assign(product, clone(updates), { updatedAt: now() });
  await persistState();
}

async function archiveLocalProduct(id) {
  await updateLocalProduct(id, { archived: 1 });
}

async function saveLocalProductImage(dataUrl, fileName) {
  const match = String(dataUrl || "").match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
  if (!match) throw new Error("Պատկերի տվյալը սխալ ձևաչափ ունի");

  const contentType = match[1];
  const extension = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : contentType.includes("webp") ? "webp" : "jpg";
  const baseName = String(fileName || "product").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "product";
  const fileNameWithId = `${baseName}_${Date.now()}_${randomBytes(6).toString("hex")}.${extension}`;
  await mkdir(localImageDirectory(), { recursive: true });
  await writeFile(path.join(localImageDirectory(), fileNameWithId), Buffer.from(match[2], "base64"));
  return `/local-assets/images/${fileNameWithId}`;
}

async function createLocalOrder(order) {
  const state = await getLocalState();
  const id = state.counters.order++;
  const timestamp = now();
  state.orders.unshift({ id, ...clone(order), status: "new", createdAt: timestamp, updatedAt: timestamp });
  await persistState();
  return id;
}

async function listLocalOrders() {
  const state = await getLocalState();
  return clone([...state.orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
}

async function listLocalOrdersForStore(storeId) {
  const orders = await listLocalOrders();
  return orders.filter((order) => order.storeId === storeId);
}

async function getLocalOrderById(id) {
  const state = await getLocalState();
  const order = state.orders.find((entry) => entry.id === id);
  return order ? clone(order) : undefined;
}

async function updateLocalOrder(id, updates) {
  const state = await getLocalState();
  const order = state.orders.find((entry) => entry.id === id);
  if (!order) throw new Error("Պատվերը չի գտնվել");
  Object.assign(order, clone(updates), { updatedAt: now() });
  await persistState();
}

async function getLocalSetting(key) {
  const state = await getLocalState();
  return state.settings[key] ?? null;
}

async function setLocalSetting(key, value) {
  const state = await getLocalState();
  state.settings[key] = value;
  await persistState();
}

async function hasLocalAdminStaffAccount() {
  const state = await getLocalState();
  return state.staffAccounts.some((account) => account.role === "admin" && account.active === 1);
}

async function getLocalStaffAccountByUsername(username) {
  const state = await getLocalState();
  const account = state.staffAccounts.find((entry) => entry.username === username);
  return account ? clone(account) : undefined;
}

async function listLocalStaffAccounts() {
  const state = await getLocalState();
  return clone([...state.staffAccounts]
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map(({ passwordHash, ...account }) => account));
}

async function createLocalStaffAccount(account) {
  const state = await getLocalState();
  const id = state.counters.staff++;
  const timestamp = now();
  state.staffAccounts.push({
    id,
    ...clone(account),
    active: account.active ?? 1,
    storeId: account.storeId ?? null,
    lastSignedIn: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  await persistState();
  return id;
}

async function updateLocalStaffAccount(id, updates) {
  const state = await getLocalState();
  const account = state.staffAccounts.find((entry) => entry.id === id);
  if (!account) throw new Error("Մուտքը չի գտնվել");
  Object.assign(account, clone(updates), { updatedAt: now() });
  await persistState();
}

function resetLocalStoreCacheForTesting() {
  cachedState = null;
  writeQueue = Promise.resolve();
}

export {
  archiveLocalProduct,
  createLocalOrder,
  createLocalProduct,
  createLocalStaffAccount,
  getLocalOrderById,
  getLocalProductById,
  getLocalSessionSigningSecret,
  getLocalSetting,
  getLocalStaffAccountByUsername,
  hasLocalAdminStaffAccount,
  isLocalMode,
  listLocalOrders,
  listLocalOrdersForStore,
  listLocalProducts,
  listLocalStaffAccounts,
  resetLocalStoreCacheForTesting,
  saveLocalProductImage,
  setLocalSetting,
  updateLocalOrder,
  updateLocalProduct,
  updateLocalStaffAccount
};
