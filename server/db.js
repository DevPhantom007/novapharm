import { MongoClient } from "mongodb";
import { ENV } from "./_core/env.js";
import * as localStore from "./localStore.js";

/**
 * Collections used (MongoDB is schemaless, so this is documentation, not enforcement):
 *
 *  users            { id, openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn }
 *  products         { id, sku, nameHy, nameRu, nameEn, descriptionHy, descriptionRu, descriptionEn,
 *                     category, price, unit, image, rx, outOfStock, archived, sortOrder, createdAt, updatedAt }
 *  storeStocks      { id, productId, storeId, qty, updatedAt }
 *  orders           { id, items, customerName, customerPhone, customerAddress, storeId, paymentMethod,
 *                     status: "new"|"preparing"|"ready"|"delivering"|"done"|"cancelled",
 *                     courierId, recipientLat, recipientLon, note, createdAt, updatedAt }
 *  settings         { id, key, value, updatedAt }
 *  staffAccounts    { id, username, displayName, role: "admin"|"staff"|"courier", storeId,
 *                     passwordHash, active, lastSignedIn, createdAt, updatedAt }
 *  pushSubscriptions{ id, accountId, role, storeId, endpoint, keys: { p256dh, auth }, createdAt }
 *  counters         { _id: <collectionName>, seq }
 */

let _client = null;
let _db = null;
const usesLocalData = () => localStore.isLocalMode();
const getLocalSessionSigningSecret = () => localStore.getLocalSessionSigningSecret();
const productIdentity = (product) => `${String(product.nameHy || product.nameRu || product.nameEn || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()}|${String(product.unit || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()}`;

async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _client = new MongoClient(ENV.databaseUrl);
      await _client.connect();
      _db = _client.db(ENV.mongoDbName);
      await ensureIndexes(_db);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _client = null;
      _db = null;
    }
  }
  return _db;
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("users").createIndex({ openId: 1 }, { unique: true }),
    db.collection("products").createIndex({ id: 1 }, { unique: true }),
    db.collection("products").createIndex({ archived: 1, sortOrder: 1, id: 1 }),
    db.collection("storeStocks").createIndex({ productId: 1, storeId: 1 }, { unique: true }),
    db.collection("orders").createIndex({ id: 1 }, { unique: true }),
    db.collection("orders").createIndex({ storeId: 1, createdAt: -1 }),
    db.collection("orders").createIndex({ status: 1, courierId: 1 }),
    db.collection("settings").createIndex({ key: 1 }, { unique: true }),
    db.collection("staffAccounts").createIndex({ username: 1 }, { unique: true }),
    db.collection("pushSubscriptions").createIndex({ endpoint: 1 }, { unique: true })
  ]).catch((error) => console.warn("[Database] Index setup warning:", error?.message || error));
}

/** Simple auto-increment helper so the rest of the app can keep using plain numeric ids. */
async function nextId(db, sequenceName) {
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return (result?.seq ?? result?.value?.seq);
}

async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const col = db.collection("users");
  const fields = {};
  for (const field of ["name", "email", "loginMethod"]) {
    if (user[field] !== undefined) fields[field] = user[field] ?? null;
  }
  fields.lastSignedIn = user.lastSignedIn !== undefined ? user.lastSignedIn : new Date();
  if (user.role !== undefined) fields.role = user.role;
  else if (user.openId === ENV.ownerOpenId) fields.role = "admin";

  const existing = await col.findOne({ openId: user.openId });
  if (existing) {
    await col.updateOne({ _id: existing._id }, { $set: fields });
    return;
  }
  const id = await nextId(db, "users");
  await col.insertOne({
    id,
    openId: user.openId,
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...fields
  });
}

async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.collection("users").findOne({ openId })) ?? undefined;
}

async function listProducts() {
  const db = await getDb();
  if (!db) return usesLocalData() ? localStore.listLocalProducts() : [];
  const rows = await db.collection("products").find({ archived: 0 }).sort({ sortOrder: 1, id: 1 }).toArray();
  const mushStocks = await db.collection("storeStocks").find({ storeId: "mush" }).project({ productId: 1, qty: 1 }).toArray();
  const stockByProduct = new Map(mushStocks.map((row) => [row.productId, Number(row.qty)]));
  const deduplicated = new Map();
  for (const sourceProduct of rows) {
    const product = stockByProduct.has(sourceProduct.id)
      ? { ...sourceProduct, outOfStock: stockByProduct.get(sourceProduct.id) <= 0 ? 1 : 0 }
      : { ...sourceProduct };
    const key = productIdentity(product);
    const existing = deduplicated.get(key);
    if (!existing) {
      deduplicated.set(key, product);
      continue;
    }
    for (const field of ["nameRu", "nameEn", "descriptionHy", "descriptionRu", "descriptionEn", "image", "sku"]) {
      if (!existing[field] && product[field]) existing[field] = product[field];
    }
    if (existing.outOfStock && !product.outOfStock) existing.outOfStock = 0;
  }
  return [...deduplicated.values()];
}

async function getProductById(id) {
  const db = await getDb();
  if (!db) return usesLocalData() ? localStore.getLocalProductById(id) : undefined;
  return (await db.collection("products").findOne({ id })) ?? undefined;
}

async function createProduct(product) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.createLocalProduct(product);
    throw new Error("DB unavailable");
  }
  const id = await nextId(db, "products");
  const timestamp = new Date();
  await db.collection("products").insertOne({ id, ...product, createdAt: timestamp, updatedAt: timestamp });
  return id;
}

async function updateProduct(id, product) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.updateLocalProduct(id, product);
    throw new Error("DB unavailable");
  }
  await db.collection("products").updateOne({ id }, { $set: { ...product, updatedAt: new Date() } });
}

async function archiveProduct(id) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.archiveLocalProduct(id);
    throw new Error("DB unavailable");
  }
  await db.collection("products").updateOne({ id }, { $set: { archived: 1, updatedAt: new Date() } });
}

async function listStocksForProduct(productId) {
  const db = await getDb();
  if (!db) return [];
  return db.collection("storeStocks").find({ productId }).toArray();
}

async function listAllStocks() {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.collection("storeStocks").find({}).toArray();
  return rows.reduce((map, row) => {
    const productId = String(row.productId);
    if (!map[productId]) map[productId] = {};
    map[productId][row.storeId] = Number(row.qty);
    return map;
  }, {});
}

async function setStock(productId, storeId, qty) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return;
    throw new Error("DB unavailable");
  }
  await upsertStock(db, productId, storeId, qty);
}

async function upsertStock(db, productId, storeId, qty) {
  const col = db.collection("storeStocks");
  const result = await col.updateOne(
    { productId, storeId },
    { $set: { qty, updatedAt: new Date() } }
  );
  if (result.matchedCount === 0) {
    const id = await nextId(db, "storeStocks");
    await col.updateOne(
      { productId, storeId },
      { $setOnInsert: { id, productId, storeId }, $set: { qty, updatedAt: new Date() } },
      { upsert: true }
    );
  }
}

async function bulkSetStock(productId, entries) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return;
    throw new Error("DB unavailable");
  }
  for (const entry of entries) {
    await upsertStock(db, productId, entry.storeId, entry.qty);
  }
}

async function createOrder(order) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.createLocalOrder(order);
    throw new Error("DB unavailable");
  }
  const id = await nextId(db, "orders");
  const timestamp = new Date();
  await db.collection("orders").insertOne({
    id,
    ...order,
    status: "new",
    courierId: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  return id;
}

async function listOrders() {
  const db = await getDb();
  if (!db) return usesLocalData() ? localStore.listLocalOrders() : [];
  return db.collection("orders").find({}).sort({ createdAt: -1 }).limit(200).toArray();
}

async function listOrdersForStore(storeId) {
  const db = await getDb();
  if (!db) return usesLocalData() ? localStore.listLocalOrdersForStore(storeId) : [];
  return db.collection("orders").find({ storeId }).sort({ createdAt: -1 }).limit(200).toArray();
}

/**
 * Couriers are not tied to a single branch: they need to see every order that is
 * ready for pickup (regardless of which branch prepared it) plus whatever they
 * personally already picked up and are currently delivering.
 */
async function listOrdersForCourier(courierId) {
  const db = await getDb();
  if (!db) return [];
  return db.collection("orders")
    .find({ $or: [{ status: "ready" }, { status: "delivering", courierId }] })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
}

async function getOrderById(id) {
  const db = await getDb();
  if (!db) return usesLocalData() ? localStore.getLocalOrderById(id) : undefined;
  return (await db.collection("orders").findOne({ id })) ?? undefined;
}

async function updateOrderStatus(id, status) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.updateLocalOrder(id, { status });
    throw new Error("DB unavailable");
  }
  await db.collection("orders").updateOne({ id }, { $set: { status, updatedAt: new Date() } });
}

async function updateOrderStore(id, storeId) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.updateLocalOrder(id, { storeId });
    throw new Error("DB unavailable");
  }
  await db.collection("orders").updateOne({ id }, { $set: { storeId, updatedAt: new Date() } });
}

/** Atomically claim a ready-for-pickup order for a courier. Returns null if it was already taken. */
async function claimOrderForCourier(id, courierId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.collection("orders").findOneAndUpdate(
    { id, status: "ready", courierId: null },
    { $set: { status: "delivering", courierId, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result?.value ?? result ?? null;
}

/** Marks a courier's own delivery as completed. Returns null if it isn't assigned to them. */
async function completeCourierOrder(id, courierId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.collection("orders").findOneAndUpdate(
    { id, status: "delivering", courierId },
    { $set: { status: "done", updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result?.value ?? result ?? null;
}

async function getSetting(key) {
  const db = await getDb();
  if (!db) return usesLocalData() ? localStore.getLocalSetting(key) : null;
  const row = await db.collection("settings").findOne({ key });
  return row?.value ?? null;
}

async function setSetting(key, value) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.setLocalSetting(key, value);
    throw new Error("DB unavailable");
  }
  const col = db.collection("settings");
  const result = await col.updateOne({ key }, { $set: { value, updatedAt: new Date() } });
  if (result.matchedCount === 0) {
    const id = await nextId(db, "settings");
    await col.updateOne(
      { key },
      { $setOnInsert: { id, key }, $set: { value, updatedAt: new Date() } },
      { upsert: true }
    );
  }
}

async function hasAdminStaffAccount() {
  const db = await getDb();
  if (!db) return usesLocalData() ? localStore.hasLocalAdminStaffAccount() : false;
  const row = await db.collection("staffAccounts").findOne({ role: "admin" });
  return Boolean(row);
}

async function getStaffAccountByUsername(username) {
  const db = await getDb();
  if (!db) return usesLocalData() ? localStore.getLocalStaffAccountByUsername(username) : undefined;
  return (await db.collection("staffAccounts").findOne({ username })) ?? undefined;
}

async function listStaffAccounts() {
  const db = await getDb();
  if (!db) return usesLocalData() ? localStore.listLocalStaffAccounts() : [];
  return db.collection("staffAccounts").find({}, {
    projection: { passwordHash: 0 }
  }).sort({ createdAt: 1 }).toArray();
}

async function createStaffAccount(account) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.createLocalStaffAccount(account);
    throw new Error("DB unavailable");
  }
  const id = await nextId(db, "staffAccounts");
  const timestamp = new Date();
  await db.collection("staffAccounts").insertOne({
    id,
    ...account,
    storeId: account.storeId ?? null,
    lastSignedIn: null,
    createdAt: timestamp,
    updatedAt: timestamp
  });
  return id;
}

async function recordStaffSignIn(id) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.updateLocalStaffAccount(id, { lastSignedIn: new Date().toISOString() });
    return;
  }
  await db.collection("staffAccounts").updateOne({ id }, { $set: { lastSignedIn: new Date() } });
}

async function updateStaffAccountStore(id, storeId) {
  const db = await getDb();
  if (!db) {
    if (usesLocalData()) return localStore.updateLocalStaffAccount(id, { storeId });
    throw new Error("DB unavailable");
  }
  await db.collection("staffAccounts").updateOne({ id }, { $set: { storeId, updatedAt: new Date() } });
}

/** --- Web Push subscriptions ---
 * Lets the server wake up a staff/courier device with an OS-level notification
 * even when the Backoffice tab isn't open or focused. See server/push.js.
 */
async function savePushSubscription(subscription) {
  const db = await getDb();
  if (!db) return;
  const col = db.collection("pushSubscriptions");
  const result = await col.updateOne(
    { endpoint: subscription.endpoint },
    { $set: { ...subscription, updatedAt: new Date() } }
  );
  if (result.matchedCount === 0) {
    const id = await nextId(db, "pushSubscriptions");
    await col.updateOne(
      { endpoint: subscription.endpoint },
      { $setOnInsert: { id, createdAt: new Date() }, $set: { ...subscription, updatedAt: new Date() } },
      { upsert: true }
    );
  }
}

async function removePushSubscription(endpoint) {
  const db = await getDb();
  if (!db) return;
  await db.collection("pushSubscriptions").deleteOne({ endpoint });
}

async function listPushSubscriptionsByRole(role) {
  const db = await getDb();
  if (!db) return [];
  return db.collection("pushSubscriptions").find({ role }).toArray();
}

/** Subscriptions belonging to admins (see everything) plus staff devices of one branch. */
async function listPushSubscriptionsForStoreOrAdmin(storeId) {
  const db = await getDb();
  if (!db) return [];
  return db.collection("pushSubscriptions").find({
    $or: [{ role: "admin" }, { role: "staff", storeId }]
  }).toArray();
}

export {
  archiveProduct,
  bulkSetStock,
  claimOrderForCourier,
  completeCourierOrder,
  createOrder,
  createProduct,
  createStaffAccount,
  getDb,
  getLocalSessionSigningSecret,
  getOrderById,
  getProductById,
  getSetting,
  getStaffAccountByUsername,
  getUserByOpenId,
  hasAdminStaffAccount,
  listAllStocks,
  listOrders,
  listOrdersForCourier,
  listOrdersForStore,
  listProducts,
  listPushSubscriptionsByRole,
  listPushSubscriptionsForStoreOrAdmin,
  listStaffAccounts,
  listStocksForProduct,
  recordStaffSignIn,
  removePushSubscription,
  savePushSubscription,
  setSetting,
  setStock,
  updateOrderStatus,
  updateOrderStore,
  updateProduct,
  updateStaffAccountStore,
  upsertUser,
  usesLocalData
};
