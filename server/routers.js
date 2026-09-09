import { COOKIE_NAME } from "../shared/const.js";
import { z } from "zod";
import * as db from "./db.js";
import * as localStore from "./localStore.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { ENV } from "./_core/env.js";
import { sendPushToSubscriptions } from "./push.js";
import {
  bearerToken,
  sessionPolicyForAccount,
  signStaffToken,
  verifyStaffToken
} from "./staffAuth.js";
import {
  hashPassword,
  normalizeUsername,
  validatePassword,
  verifyPassword,
  verifySecret
} from "./staffCredentials.js";
import { publicProcedure, router } from "./_core/trpc.js";
const ORDER_STORE_ID = "komisarner";

const STORE_IDS = [
  "khorenatsi",
  "dudko",
  "musaelyan",
  "yerevanyan",
  "demirchyan",
  "halabyan",
  "komisarner"
];
const storeIdSchema = z.enum(STORE_IDS);
function staffTokenFromRequest(req) {
  const cookieToken = String(req.headers.cookie || "").split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith("nova_staff="))?.slice("nova_staff=".length);
  return cookieToken || bearerToken(req.headers.authorization);
}
async function currentStaffAccount(req) {
  const token = staffTokenFromRequest(req);
  const claims = token ? await verifyStaffToken(token) : null;
  if (!claims) return null;
  const account = await db.getStaffAccountByUsername(claims.username);
  if (!account || account.id !== claims.id || account.active !== 1 || account.role !== claims.role) return null;
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    storeId: account.storeId
  };
}
const staffProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const account = await currentStaffAccount(ctx.req);
  if (!account) {
    throw new Error("Staff access required");
  }
  return next({ ctx: { ...ctx, staffAccount: account } });
});
const adminProcedure = staffProcedure.use(async ({ ctx, next }) => {
  if (ctx.staffAccount?.role !== "admin") throw new Error("Administrator access required");
  return next({ ctx });
});
const courierProcedure = staffProcedure.use(async ({ ctx, next }) => {
  if (ctx.staffAccount?.role !== "courier") throw new Error("Առաքիչի հասանելիություն է պահանջվում");
  return next({ ctx });
});
async function orderForStaffAccount(account, orderId) {
  const order = await db.getOrderById(orderId);
  if (!order) throw new Error("Պատվերը չի գտնված");
  if (account.role !== "admin" && (!account.storeId || account.storeId !== order.storeId)) {
    throw new Error("Այս պատվերը ձեր մասնաճյուղին չի պատկանում");
  }
  return order;
}
const appRouter = router({
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie("nova_staff", {
        ...cookieOptions,
        maxAge: -1,
        path: "/"
      });
      return { success: true };
    })
  }),
  staff: router({
    bootstrapStatus: publicProcedure.query(async () => ({
      needsAdminSetup: !(await db.hasAdminStaffAccount()),
      bootstrapKeyConfigured: Boolean(process.env.NOVA_STAFF_BOOTSTRAP_KEY),
      localMode: db.usesLocalData()
    })),
    bootstrapAdmin: publicProcedure.input(z.object({
      username: z.string().min(3).max(64),
      password: z.string().min(12).max(128),
      bootstrapKey: z.string().max(256).optional()
    })).mutation(async ({ ctx, input }) => {
      if (await db.hasAdminStaffAccount()) throw new Error("Տնօրենի հաշիվն արդեն ստեղծված է");
      if (!db.usesLocalData() && !verifySecret(input.bootstrapKey, process.env.NOVA_STAFF_BOOTSTRAP_KEY)) throw new Error("Սկզբնական կարգավորման գաղտնի կոդը սխալ է");
      const username = normalizeUsername(input.username);
      if (!/^[a-z0-9._-]{3,64}$/.test(username)) throw new Error("Մուտքանունը կարող է պարունակել միայն լատինատառ տառեր, թվեր, կետ, գծիկ և ընդգծում");
      const passwordError = validatePassword(input.password);
      if (passwordError) throw new Error(passwordError);
      const id = await db.createStaffAccount({
        username,
        displayName: username,
        role: "admin",
        passwordHash: hashPassword(input.password),
        active: 1
      });
      const account = { id, username, displayName: username, role: "admin", storeId: null };
      const token = await signStaffToken(account);
      const sessionPolicy = sessionPolicyForAccount(account);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie("nova_staff", token, {
        ...cookieOptions,
        httpOnly: true,
        maxAge: sessionPolicy.cookieMaxAge,
        path: "/"
      });
      return { success: true, token };
    }),
    login: publicProcedure.input(z.object({ username: z.string().min(1), password: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const account = await db.getStaffAccountByUsername(normalizeUsername(input.username));
      if (!account || account.active !== 1 || !verifyPassword(input.password, account.passwordHash)) throw new Error("Մուտքանունը կամ գաղտնաբառը սխալ է");
      await db.recordStaffSignIn(account.id);
      const sessionAccount = { id: account.id, username: account.username, displayName: account.displayName, role: account.role, storeId: account.storeId };
      const token = await signStaffToken(sessionAccount);
      const sessionPolicy = sessionPolicyForAccount(sessionAccount);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie("nova_staff", token, { ...cookieOptions, httpOnly: true, maxAge: sessionPolicy.cookieMaxAge, path: "/" });
      return { success: true, token, account: sessionAccount };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie("nova_staff", {
        ...cookieOptions,
        maxAge: -1,
        path: "/"
      });
      return { success: true };
    }),
    ping: staffProcedure.query(() => ({ ok: true })),
    me: publicProcedure.query(async ({ ctx }) => {
      const account = await currentStaffAccount(ctx.req);
      return { isStaff: Boolean(account), account };
    }),
    accounts: router({
      list: adminProcedure.query(() => db.listStaffAccounts()),
      create: adminProcedure.input(z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(12).max(128),
        role: z.enum(["staff", "admin", "courier"]).default("staff"),
        storeId: storeIdSchema.optional()
      })).mutation(async ({ input }) => {
        const username = normalizeUsername(input.username);
        if (!/^[a-z0-9._-]{3,64}$/.test(username)) throw new Error("Մուտքանունը կարող է պարունակել միայն լատինատառ տառեր, թվեր, կետ, գծիկ և ընդգծում");
        const passwordError = validatePassword(input.password);
        if (passwordError) throw new Error(passwordError);
        if (await db.getStaffAccountByUsername(username)) throw new Error("Այս մուտքանունն արդեն օգտագործվում է");
        if (input.role === "staff" && !input.storeId) throw new Error("Մասնաճյուղային սարքի մուտքի համար ընտրեք մասնաճյուղը");
        const id = await db.createStaffAccount({
          username,
          displayName: username,
          role: input.role,
          storeId: input.role === "staff" ? input.storeId : null,
          passwordHash: hashPassword(input.password),
          active: 1
        });
        return { id };
      }),
      updateStore: adminProcedure.input(z.object({
        id: z.number(),
        storeId: storeIdSchema.nullable()
      })).mutation(async ({ input }) => {
        await db.updateStaffAccountStore(input.id, input.storeId);
        return { success: true };
      })
    }),
    // Web Push subscriptions: let a staff/courier device receive an order alert
    // as an OS-level notification, even when the Backoffice tab isn't open or
    // the phone screen is locked. This does not help if the device itself is
    // powered off or fully offline — there is no SMS/Telegram fallback wired up.
    push: router({
      publicKey: publicProcedure.query(() => ({ publicKey: ENV.vapidPublicKey || null })),
      subscribe: staffProcedure.input(z.object({
        endpoint: z.string().min(1),
        keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) })
      })).mutation(async ({ ctx, input }) => {
        await db.savePushSubscription({
          accountId: ctx.staffAccount.id,
          role: ctx.staffAccount.role,
          storeId: ctx.staffAccount.storeId ?? null,
          endpoint: input.endpoint,
          keys: input.keys
        });
        return { success: true };
      }),
      unsubscribe: staffProcedure.input(z.object({ endpoint: z.string().min(1) })).mutation(async ({ input }) => {
        await db.removePushSubscription(input.endpoint);
        return { success: true };
      })
    })
  }),
  products: router({
    list: publicProcedure.query(() => db.listProducts()),
    stock: publicProcedure.input(z.object({ productId: z.number() })).query(({ input }) => db.listStocksForProduct(input.productId)),
    allStocks: publicProcedure.query(() => db.listAllStocks()),
    create: adminProcedure.input(
      z.object({
        sku: z.string().optional(),
        nameHy: z.string().min(1),
        nameRu: z.string().optional(),
        nameEn: z.string().optional(),
        descriptionHy: z.string().optional(),
        descriptionRu: z.string().optional(),
        descriptionEn: z.string().optional(),
        category: z.string().min(1),
        price: z.number().int().min(0),
        unit: z.string().min(1),
        image: z.string().optional(),
        rx: z.number().int().optional(),
        outOfStock: z.boolean().optional(),
        stocks: z.record(z.string(), z.number().int().min(0)).optional()
      })
    ).mutation(async ({ input }) => {
      const { stocks, outOfStock, ...rest } = input;
      const id = await db.createProduct({
        ...rest,
        outOfStock: outOfStock ? 1 : 0,
        archived: 0,
        sortOrder: 0
      });
      if (stocks) {
        const entries = Object.entries(stocks).filter(([k]) => STORE_IDS.includes(k)).map(([storeId, qty]) => ({ storeId, qty }));
        if (entries.length) await db.bulkSetStock(id, entries);
      }
      return { id };
    }),
    update: adminProcedure.input(
      z.object({
        id: z.number(),
        sku: z.string().optional(),
        nameHy: z.string().optional(),
        nameRu: z.string().nullable().optional(),
        nameEn: z.string().nullable().optional(),
        descriptionHy: z.string().nullable().optional(),
        descriptionRu: z.string().nullable().optional(),
        descriptionEn: z.string().nullable().optional(),
        category: z.string().optional(),
        price: z.number().int().min(0).optional(),
        unit: z.string().optional(),
        image: z.string().nullable().optional(),
        rx: z.number().int().optional(),
        outOfStock: z.boolean().optional(),
        stocks: z.record(z.string(), z.number().int().min(0)).optional()
      })
    ).mutation(async ({ input }) => {
      const { id, stocks, outOfStock, ...rest } = input;
      if (stocks) {
        const entries = Object.entries(stocks).filter(([k]) => STORE_IDS.includes(k)).map(([storeId, qty]) => ({ storeId, qty }));
        if (entries.length) await db.bulkSetStock(id, entries);
      }
      const clean = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== void 0) clean[k] = v;
      }
      if (outOfStock !== void 0) clean.outOfStock = outOfStock ? 1 : 0;
      if (Object.keys(clean).length) await db.updateProduct(id, clean);
      return { success: true };
    }),
    /** Ադմինից մեկ սեղմումով նշում ենք ապրանքը որպես «վերջացել է / առկա չէ» կամ վերականգնում առկայությունը։ Ապրանքը մնում է կայքում, բայց չի կարելի պատվիրել։ */
    setOutOfStock: adminProcedure.input(z.object({
      id: z.number(),
      outOfStock: z.boolean()
    })).mutation(async ({ input }) => {
      await db.updateProduct(input.id, { outOfStock: input.outOfStock ? 1 : 0 });
      return { success: true };
    }),
    archive: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.archiveProduct(input.id);
      return { success: true };
    }),
    /** Ներբեռնում է ապրանքի լուսանկարը տեղային պահեստ և վերադարձնում է դրա URL-ը */
    imageUpload: adminProcedure.input(
      z.object({
        dataUrl: z.string().min(1),
        fileName: z.string().optional()
      })
    ).mutation(async ({ input }) => {
      const match = input.dataUrl.match(
        /^data:(image\/[\w+.-]+);base64,(.+)$/
      );
      if (!match) throw new Error("Պատկերի տվյալը սխալ ձևաչափ ունի");
      const contentType = match[1];
      if (!contentType.startsWith("image/"))
        throw new Error("Ֆայլը պետք է լինի նկար (JPG/PNG/GIF)");
      const baseName = (input.fileName || "product").replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );
      const url = await localStore.saveLocalProductImage(input.dataUrl, baseName);
      return { url };
    }),
    setStock: staffProcedure.input(z.object({ productId: z.number(), storeId: storeIdSchema, qty: z.number().int().min(0) })).mutation(async ({ input }) => {
      await db.setStock(input.productId, input.storeId, input.qty);
      return { success: true };
    })
  }),
  orders: router({
    list: staffProcedure.query(({ ctx }) => {
      if (ctx.staffAccount.role === "admin") return db.listOrders();
      if (ctx.staffAccount.role === "courier") return db.listOrdersForCourier(ctx.staffAccount.id);
      if (!ctx.staffAccount.storeId) return [];
      return db.listOrdersForStore(ctx.staffAccount.storeId);
    }),
    byId: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getOrderById(input.id)),
    create: publicProcedure.input(
      z.object({
        items: z.array(
          z.object({
            productId: z.number(),
            name: z.string(),
            qty: z.number().int().min(1),
            price: z.number().int().min(0)
          })
        ),
        total: z.number().int().min(0),
        customerName: z.string().min(1),
        customerPhone: z.string().min(1),
        customerAddress: z.string().optional(),
        // Public orders always go to the Mush pharmacy; the client cannot override it.
        storeId: z.string().optional(),
        paymentMethod: z.string().optional(),
        note: z.string().optional(),
        recipientLat: z.number().nullable().optional(),
        recipientLon: z.number().nullable().optional()
      })
    ).mutation(async ({ input }) => {
      const id = await db.createOrder({
        items: { cart: input.items, total: input.total, note: input.note },
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerAddress: input.customerAddress ?? null,
        storeId: ORDER_STORE_ID,
        paymentMethod: input.paymentMethod ?? "cash",
        note: input.note ?? null,
        recipientLat: input.recipientLat ?? null,
        recipientLon: input.recipientLon ?? null
      });
      // Wake up the branch device + admins even if nobody is currently looking at
      // the Backoffice tab. Never let a push failure block placing the order.
      db.listPushSubscriptionsForStoreOrAdmin(ORDER_STORE_ID)
        .then((subs) => sendPushToSubscriptions(subs, {
          title: "Նոր պատվեր",
          body: `Պատվեր #${id} ստացվել է՝ ${input.customerName}`,
          url: "/backoffice",
          tag: `order-${id}`
        }))
        .catch(() => {});
      return { id };
    }),
    // Branch staff progress an order through preparation. Couriers use the
    // dedicated claim/complete endpoints below instead.
    setStatus: staffProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["preparing", "ready", "cancelled"])
    })).mutation(async ({ ctx, input }) => {
      const order = await orderForStaffAccount(ctx.staffAccount, input.id);
      if (["done", "cancelled", "delivering"].includes(order.status)) {
        throw new Error("Այս պատվերն այլևս հնարավոր չէ փոփոխել");
      }
      await db.updateOrderStatus(input.id, input.status);
      if (input.status === "ready") {
        // Any available courier can pick this up — broadcast to all of them.
        db.listPushSubscriptionsByRole("courier")
          .then((subs) => sendPushToSubscriptions(subs, {
            title: "Առաքման պատրաստ պատվեր",
            body: `Պատվեր #${input.id} պատրաստ է առաքման`,
            url: "/backoffice",
            tag: `order-${input.id}`,
            requireInteraction: true
          }))
          .catch(() => {});
      }
      return { success: true };
    }),
    // Courier claims a ready order. Atomic on the DB side so two couriers can't grab the same order.
    courierClaim: courierProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const order = await db.claimOrderForCourier(input.id, ctx.staffAccount.id);
      if (!order) throw new Error("Այս պատվերն արդեն վերցված է կամ դեռ պատրաստ չէ");
      return { success: true };
    }),
    // Courier marks their own delivery as completed.
    courierComplete: courierProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const order = await db.completeCourierOrder(input.id, ctx.staffAccount.id);
      if (!order) throw new Error("Այս պատվերը Ձեզ նշանակված չէ");
      return { success: true };
    }),
    reassignStore: adminProcedure.input(z.object({ id: z.number(), storeId: storeIdSchema })).mutation(async ({ input }) => {
      await db.updateOrderStore(input.id, input.storeId);
      return { success: true };
    })
  }),
  settings: router({
    get: publicProcedure.input(z.object({ key: z.string() })).query(({ input }) => db.getSetting(input.key)),
    set: adminProcedure.input(z.object({ key: z.string(), value: z.string() })).mutation(async ({ input }) => {
      await db.setSetting(input.key, input.value);
      return { success: true };
    })
  })
});
export {
  appRouter
};
