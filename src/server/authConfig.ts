export const JWT_SECRET = process.env.JWT_SECRET || "construction-company-secret-key-2026";

if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.warn("⚠️ [SECURITY NOTICE] Production deployment detected without a custom 32+ character JWT_SECRET! Please supply a secure JWT_SECRET in your environment.");
}
