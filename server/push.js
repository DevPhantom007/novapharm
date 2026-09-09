import webpush from "web-push";
import { ENV } from "./_core/env.js";
import { removePushSubscription } from "./db.js";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!ENV.vapidPublicKey || !ENV.vapidPrivateKey) return false;
  webpush.setVapidDetails(ENV.vapidSubject, ENV.vapidPublicKey, ENV.vapidPrivateKey);
  configured = true;
  return true;
}

/**
 * Sends a push notification to a list of stored subscriptions.
 * Silently drops subscriptions that the browser has revoked (404/410) and never
 * throws — a failed/missing push must never block placing or updating an order.
 */
async function sendPushToSubscriptions(subscriptions, payload) {
  if (!subscriptions?.length) return;
  if (!ensureConfigured()) {
    console.warn("[Push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not configured — skipping push notification.");
    return;
  }
  const body = JSON.stringify(payload);
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        body
      );
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await removePushSubscription(subscription.endpoint).catch(() => {});
      } else {
        console.warn("[Push] Failed to deliver notification:", error?.message || error);
      }
    }
  }));
}

export { sendPushToSubscriptions };
