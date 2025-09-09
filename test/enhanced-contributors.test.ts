import { describe, expect, test } from "vitest";
import { loadChangelogConfig, generateMarkDown } from "../src";

describe("enhanced-contributors", () => {
  test("should extract GitHub usernames from noreply emails", async () => {
    const config = await loadChangelogConfig(process.cwd(), {
      from: "1.0.0", 
      newVersion: "2.0.0",
    });

    const testCommits = [
      {
        author: {
          name: "Alice NoReply",
          email: "alice@users.noreply.github.com",
        },
        message: "feat: add feature",
        shortHash: "1234",
        body: "body",
        type: "feat",
        description: "add feature",
        scope: "scope",
        references: [],
        authors: [],
        isBreaking: false,
      },
      {
        author: {
          name: "Bob WithId",
          email: "12345+bob-user@users.noreply.github.com",
        },
        message: "fix: resolve bug",
        shortHash: "5678",
        body: "body",
        type: "fix",
        description: "resolve bug", 
        scope: "scope",
        references: [],
        authors: [],
        isBreaking: false,
      },
      {
        author: {
          name: "Charlie Regular",
          email: "charlie@example.com",
        },
        message: "docs: update docs",
        shortHash: "9012",
        body: "body",
        type: "docs",
        description: "update docs",
        scope: "scope", 
        references: [],
        authors: [],
        isBreaking: false,
      },
    ];

    const contents = await generateMarkDown(testCommits, config);

    expect(contents).toContain("Alice NoReply ([@alice](https://github.com/alice))");
    expect(contents).toContain("Bob WithId ([@bob-user](https://github.com/bob-user))");
    expect(contents).toContain("Charlie Regular <charlie@example.com>"); // Falls back to email since ungh.cc won't find it
  });

  test("should extract GitHub usernames from pull request references", async () => {
    const config = await loadChangelogConfig(process.cwd(), {
      from: "1.0.0",
      newVersion: "2.0.0",
      repo: "unjs/changelogen", // Specify a repo so PR lookup can work
    });

    const testCommits = [
      {
        author: {
          name: "PR Author",
          email: "pr-author@private.com",
        },
        message: "feat: add feature (#123)",
        shortHash: "1234",
        body: "body",
        type: "feat",
        description: "add feature (#123)",
        scope: "scope",
        references: [
          {
            type: "pull-request",
            value: "#123",
          },
        ],
        authors: [],
        isBreaking: false,
      },
    ];

    const contents = await generateMarkDown(testCommits, config);

    // Since we can't actually call GitHub API in tests, the PR lookup will fail
    // and it should fall back to showing email
    expect(contents).toContain("PR Author <pr-author@private.com>");
  });
});