// Centralized deployment configuration for VisionX platform

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
