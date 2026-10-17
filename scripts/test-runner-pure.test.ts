import { describe, expect, it } from "vitest";
import {
  rewriteDatabaseUrlForDocker,
  shouldRunVitestInDocker,
} from "./test-runner-pure.mjs";

describe("rewriteDatabaseUrlForDocker", () => {
  it("remplace 127.0.0.1 par host.docker.internal", () => {
    expect(
      rewriteDatabaseUrlForDocker(
        "postgresql://u:p@127.0.0.1:5433/discelyn?schema=public"
      )
    ).toBe("postgresql://u:p@host.docker.internal:5433/discelyn?schema=public");
  });

  it("remplace localhost et ::1", () => {
    expect(
      rewriteDatabaseUrlForDocker("postgresql://u:p@localhost:5433/db")
    ).toBe("postgresql://u:p@host.docker.internal:5433/db");
    expect(
      rewriteDatabaseUrlForDocker("postgresql://u:p@[::1]:5433/db")
    ).toBe("postgresql://u:p@host.docker.internal:5433/db");
  });

  it("laisse host.docker.internal inchangé", () => {
    const url = "postgresql://u:p@host.docker.internal:5433/db";
    expect(rewriteDatabaseUrlForDocker(url)).toBe(url);
  });
});

describe("shouldRunVitestInDocker", () => {
  it("active Docker sur win32 hors CI", () => {
    expect(
      shouldRunVitestInDocker({ platform: "win32", ci: false })
    ).toBe(true);
  });

  it("désactive sur Linux / CI", () => {
    expect(
      shouldRunVitestInDocker({ platform: "linux", ci: false })
    ).toBe(false);
    expect(
      shouldRunVitestInDocker({ platform: "win32", ci: true })
    ).toBe(false);
  });

  it("respecte forceHost / forceDocker", () => {
    expect(
      shouldRunVitestInDocker({
        platform: "win32",
        forceHost: true,
      })
    ).toBe(false);
    expect(
      shouldRunVitestInDocker({
        platform: "linux",
        forceDocker: true,
      })
    ).toBe(true);
  });
});
