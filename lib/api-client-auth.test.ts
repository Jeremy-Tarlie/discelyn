import { afterEach, describe, expect, it, vi } from "vitest";
import { redirectIfMfaRequired } from "./api-client-auth";

describe("redirectIfMfaRequired", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ne redirige pas hors navigateur", () => {
    vi.stubGlobal("window", undefined);
    expect(redirectIfMfaRequired({ code: "mfa_required" })).toBe(false);
  });

  it("ne redirige pas sans code mfa_required", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: {
        origin: "https://app.example",
        assign,
      },
    });
    expect(redirectIfMfaRequired({ code: "other" })).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it("redirige en URL absolue vers le challenge MFA", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: {
        origin: "https://app.example",
        assign,
      },
    });
    expect(redirectIfMfaRequired({ code: "mfa_required" })).toBe(true);
    expect(assign).toHaveBeenCalledWith("https://app.example/login/mfa");
  });
});
