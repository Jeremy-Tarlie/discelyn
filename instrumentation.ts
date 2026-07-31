export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const required = [
      "DATABASE_URL",
      "NEXTAUTH_SECRET",
      "NEXTAUTH_URL",
      "DISCORD_CLIENT_ID",
      "DISCORD_CLIENT_SECRET",
      "BOT_SECRETS_ENCRYPTION_KEY",
    ] as const;

    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0 && process.env.NODE_ENV === "production") {
      throw new Error(
        `Variables d'environnement manquantes: ${missing.join(", ")}`
      );
    }
  }
}
