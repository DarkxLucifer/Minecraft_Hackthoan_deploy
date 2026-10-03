// Centralized deployment configuration for VisionX platform

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
