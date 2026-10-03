// Centralized deployment configuration for VisionX platform

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "https://yashraj9696-test.hf.space";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
