import crypto from "node:crypto";

const configuredJwtSecret = process.env.JWT_SECRET?.trim();
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!configuredJwtSecret || configuredJwtSecret.length < 32)) {
  throw new Error("JWT_SECRET must be set to a 32+ character value in production.");
}

if (!configuredJwtSecret) {
  console.warn("[Security] JWT_SECRET is not set. Using an ephemeral development secret.");
}

export const JWT_SECRET = configuredJwtSecret || crypto.randomBytes(32).toString("hex");
