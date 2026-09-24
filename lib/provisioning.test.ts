import { describe, expect, it } from "vitest";
import { provisionBot } from "@/lib/provisioning";

describe("provisionBot", () => {
  it("reste PENDING sans serveur lié", async () => {
    const result = await provisionBot({
      botId: "b1",
      guildLinked: false,
      botPresentInGuild: false,
    });
    expect(result.status).toBe("PENDING");
  });

  it("reste PENDING si lié mais bot absent", async () => {
    const result = await provisionBot({
      botId: "b1",
      guildLinked: true,
      botPresentInGuild: false,
    });
    expect(result.status).toBe("PENDING");
  });
});
