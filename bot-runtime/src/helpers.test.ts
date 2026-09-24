import { describe, expect, it } from "vitest";
import {
  evaluateAutomod,
  isTicketChannelName,
  matchPrefixCommand,
  normalizeSlashName,
  parseModerationCommand,
  parseReactionRoles,
  RecentMessageTracker,
  resolveWelcomeText,
} from "./helpers";

describe("parseModerationCommand", () => {
  it("parse kick avec mention et raison", () => {
    expect(parseModerationCommand("!kick <@123456789012345678> flood", "!")).toEqual({
      type: "kick",
      targetId: "123456789012345678",
      reason: "flood",
    });
  });

  it("parse timeout avec minutes", () => {
    expect(
      parseModerationCommand("!timeout 123456789012345678 10 spam", "!")
    ).toEqual({
      type: "timeout",
      targetId: "123456789012345678",
      minutes: 10,
      reason: "spam",
    });
  });

  it("parse warnings et clearwarns", () => {
    expect(
      parseModerationCommand("!warnings 123456789012345678", "!")
    ).toEqual({ type: "warnings", targetId: "123456789012345678" });
    expect(
      parseModerationCommand("!clearwarns 123456789012345678", "!")
    ).toEqual({ type: "clearwarns", targetId: "123456789012345678" });
  });

  it("refuse une commande inconnue", () => {
    expect(parseModerationCommand("!ping", "!")).toBeNull();
  });
});

describe("matchPrefixCommand", () => {
  it("match ! et /", () => {
    const commands = [{ name: "/hello", response: "salut" }];
    expect(matchPrefixCommand("!hello", commands)).toBe("salut");
    expect(matchPrefixCommand("/hello", commands)).toBe("salut");
  });
});

describe("normalizeSlashName", () => {
  it("nettoie le nom", () => {
    expect(normalizeSlashName("!Hello World!")).toBe("helloworld");
  });
});

describe("parseReactionRoles", () => {
  it("accepte des entrées valides et borne à 25", () => {
    const roles = parseReactionRoles([
      { messageId: "1", emoji: "👍", roleId: "2" },
      { messageId: 3, emoji: "x", roleId: "y" },
    ]);
    expect(roles).toEqual([{ messageId: "1", emoji: "👍", roleId: "2" }]);
  });
});

describe("evaluateAutomod", () => {
  it("détecte mot interdit, invite et mentions", () => {
    expect(
      evaluateAutomod("acheter spam ici", {
        bannedWords: ["spam"],
        blockInvites: true,
        blockLinks: false,
        maxMentions: 2,
      })?.kind
    ).toBe("banned_word");
    expect(
      evaluateAutomod("rejoins discord.gg/abc", {
        bannedWords: [],
        blockInvites: true,
        blockLinks: false,
        maxMentions: 5,
      })?.kind
    ).toBe("invite");
    expect(
      evaluateAutomod("<@1> <@2> <@3>", {
        bannedWords: [],
        blockInvites: false,
        blockLinks: false,
        maxMentions: 2,
      })?.kind
    ).toBe("mentions");
  });
});

describe("RecentMessageTracker", () => {
  it("détecte un doublon rapide", () => {
    const tracker = new RecentMessageTracker(5_000);
    expect(tracker.isSpam("u1", "hello", 1000)).toBe(false);
    expect(tracker.isSpam("u1", "hello", 2000)).toBe(true);
    expect(tracker.isSpam("u1", "other", 2500)).toBe(false);
  });
});

describe("isTicketChannelName", () => {
  it("reconnaît le préfixe ticket-", () => {
    expect(isTicketChannelName("ticket-alice")).toBe(true);
    expect(isTicketChannelName("general")).toBe(false);
  });
});

describe("resolveWelcomeText", () => {
  const channels = [
    { id: "111", name: "règles" },
    { id: "222", name: "bienvenue" },
  ];

  it("remplace {rules} et #nom par des mentions Discord", () => {
    const text = resolveWelcomeText({
      template: "Lis {rules} ou #règles — salut {user}",
      memberMention: "<@999>",
      username: "alice",
      rulesChannelId: "111",
      channels,
    });
    expect(text).toBe("Lis <#111> ou <#111> — salut alice");
  });

  it("ne casse pas une mention déjà formée <#id>", () => {
    const text = resolveWelcomeText({
      template: "Voir <#111> et #bienvenue",
      memberMention: "<@1>",
      username: "x",
      rulesChannelId: "",
      channels,
    });
    expect(text).toBe("Voir <#111> et <#222>");
  });
});

