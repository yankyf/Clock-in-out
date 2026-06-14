export const PORT = Number(process.env.PORT ?? 4000);
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";

if (process.env.NODE_ENV === "production" && JWT_SECRET === "dev-only-change-me") {
  throw new Error("Refusing to start in production with the default JWT_SECRET. Set JWT_SECRET.");
}
