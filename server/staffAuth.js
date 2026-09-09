import { SignJWT, jwtVerify } from "jose";
const AUDIENCE = "nova-staff";
const ISSUER = "nova-pharm";
import { getLocalSessionSigningSecret, usesLocalData } from "./db.js";
const ADMIN_SESSION_POLICY = {
  tokenExpiration: "7d",
  cookieMaxAge: 1000 * 60 * 60 * 24 * 7
};
const BRANCH_DEVICE_SESSION_POLICY = {
  tokenExpiration: "30d",
  cookieMaxAge: 1000 * 60 * 60 * 24 * 30
};
async function secretKey() {
  const secret = usesLocalData()
    ? await getLocalSessionSigningSecret()
    : process.env.JWT_SECRET || "nova-dev-secret";
  return new TextEncoder().encode(secret);
}
function sessionPolicyForAccount(account) {
  return account?.role !== "admin" ? BRANCH_DEVICE_SESSION_POLICY : ADMIN_SESSION_POLICY;
}
async function signStaffToken(account) {
  const { tokenExpiration } = sessionPolicyForAccount(account);
  const token = await new SignJWT({
    staff: true,
    accountId: account.id,
    role: account.role,
    username: account.username,
    displayName: account.displayName
  }).setProtectedHeader({ alg: "HS256" }).setAudience(AUDIENCE).setIssuer(ISSUER).setExpirationTime(tokenExpiration).sign(await secretKey());
  return token;
}
async function verifyStaffToken(token) {
  try {
    const { payload } = await jwtVerify(token, await secretKey(), {
      audience: AUDIENCE,
      issuer: ISSUER
    });
    if (payload.staff !== true || !Number.isInteger(payload.accountId) || !["admin", "staff", "courier"].includes(payload.role)) return null;
    return {
      id: payload.accountId,
      role: payload.role,
      username: payload.username,
      displayName: payload.displayName
    };
  } catch {
    return null;
  }
}
function bearerToken(authHeader) {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1] : null;
}
export {
  bearerToken,
  sessionPolicyForAccount,
  signStaffToken,
  verifyStaffToken
};
