import { describe, expect, test } from "vitest";
import { loginFromNoReply } from "../src/utils/github-username";

describe("github-username", () => {
  test("should extract login from noreply email", () => {
    expect(loginFromNoReply("username@users.noreply.github.com")).toBe(
      "username"
    );
    expect(loginFromNoReply("12345+username@users.noreply.github.com")).toBe(
      "username"
    );
    expect(loginFromNoReply("some-user@users.noreply.github.com")).toBe(
      "some-user"
    );
  });

  test("should return undefined for non-noreply emails", () => {
    expect(loginFromNoReply("user@example.com")).toBeUndefined();
    expect(loginFromNoReply("user@github.com")).toBeUndefined();
    expect(loginFromNoReply("")).toBeUndefined();
    expect(loginFromNoReply(undefined)).toBeUndefined();
  });

  test("should handle case insensitive matching", () => {
    expect(loginFromNoReply("USERNAME@users.noreply.github.com")).toBe(
      "username"
    );
    expect(loginFromNoReply("12345+USERNAME@USERS.NOREPLY.GITHUB.COM")).toBe(
      "username"
    );
  });
});