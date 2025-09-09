import { describe, expect, test, vi } from "vitest";
import { loadChangelogConfig } from "../src";

// Mock the github module for this test file
vi.mock("../src/github", async () => {
  const actual = await vi.importActual("../src/github");
  return {
    ...actual,
    getPullRequestAuthorLogin: vi.fn().mockResolvedValue("pr-author-username")
  };
});

describe("enhanced-contributors with mocked GitHub API", () => {
  test("should extract GitHub usernames from pull request references with successful API mock", async () => {
    // Import the mocked generateMarkDown
    const { generateMarkDown } = await import("../src");
    const { getPullRequestAuthorLogin } = await import("../src/github");
    const mockGetPullRequestAuthorLogin = getPullRequestAuthorLogin as any;

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

    // With successful API mock, should show GitHub username format
    expect(contents).toContain("PR Author ([@pr-author-username](https://github.com/pr-author-username))");
    
    // Verify the mock was called
    expect(mockGetPullRequestAuthorLogin).toHaveBeenCalledWith(config, 123);
  });
});