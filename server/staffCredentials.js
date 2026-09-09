import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 12) return "Գաղտնաբառը պետք է ունենա առնվազն 12 նիշ";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Գաղտնաբառը պետք է պարունակի մեծատառ, փոքրատառ և թիվ";
  }
  return null;
}

function hashPassword(password) {
  const error = validatePassword(password);
  if (error) throw new Error(error);
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, encoded) {
  const [algorithm, salt, expected] = String(encoded || "").split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(String(password || ""), salt, 64).toString("hex");
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function verifySecret(value, expected) {
  const actualBuffer = Buffer.from(String(value || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  return actualBuffer.length > 0 && actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export { hashPassword, normalizeUsername, validatePassword, verifyPassword, verifySecret };
