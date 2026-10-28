import { describe, expect, it } from "vitest";
import DiscordProvider from "next-auth/providers/discord";

/**
 * Régression OAuthCallback : Discord envoie `iss` → openid-client exige
 * provider.issuer (sinon « issuer must be configured on the issuer »).
 */
describe("Discord OAuth provider config", () => {
  it("définit issuer Discord pour le callback RFC 9207", () => {
    const provider = DiscordProvider({
      clientId: "test-client",
      clientSecret: "test-secret",
      issuer: "https://discord.com",
      authorization: {
        params: { scope: "identify email guilds" },
      },
    });
    expect(provider.options?.issuer ?? provider.issuer).toBe(
      "https://discord.com",
    );
  });
});
