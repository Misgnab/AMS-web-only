import dotenv from "dotenv";
dotenv.config();

const rawSecret = process.env.JWT_SECRET || "";
export const JWT_SECRET = rawSecret.trim() || "construction-company-secret-key-2026";

if (process.env.NODE_ENV === "production" && (!rawSecret || rawSecret.trim().length < 32)) {
  console.warn("⚠️ [SECURITY NOTICE] Production deployment detected without a custom 32+ character JWT_SECRET! Please supply a secure JWT_SECRET in your environment.");
}
