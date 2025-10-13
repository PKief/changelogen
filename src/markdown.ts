import { upperFirst } from "scule";
import { convert } from "convert-gitmoji";
import { fetch } from "node-fetch-native";
import type { ResolvedChangelogConfig } from "./config";
import type { GitCommit, Reference } from "./git";
import { formatReference, formatCompareChanges } from "./repo";
import { getPullRequestAuthorLogin } from "./github";
import { loginFromNoReply } from "./utils/github-username";

export async function generateMarkDown(
  commits: GitCommit[],
  config: ResolvedChangelogConfig
) {
  const typeGroups = groupBy(commits, "type");

  const markdown: string[] = [];
  const breakingChanges = [];

  // Version Title
  const v =
    config.newVersion &&
    config.templates.tagBody.replaceAll("{{newVersion}}", config.newVersion);
  markdown.push("", "## " + (v || `${config.from || ""}...${config.to}`), "");

  if (config.repo && config.from) {
    markdown.push(formatCompareChanges(v, config));
  }

  for (const type in config.types) {
    const group = typeGroups[type];
    if (!group || group.length === 0) {
      continue;
    }

    markdown.push("", "### " + config.types[type].title, "");
    for (const commit of group.reverse()) {
      const line = formatCommit(commit, config);
      markdown.push(line);
      if (commit.isBreaking) {
        breakingChanges.push(line);
      }
    }
  }

  if (breakingChanges.length > 0) {
    markdown.push("", "#### ⚠️ Breaking Changes", "", ...breakingChanges);
  }

  const _authors = new Map<string, { email: Set<string>; github?: string }>();
  const _authorPRs = new Map<string, Set<number>>();
  for (const commit of commits) {
    if (!commit.author) {
      continue;
    }
    const name = formatName(commit.author.name);
    if (!name || name.includes("[bot]")) {
      continue;
    }
    if (
      config.excludeAuthors &&
      config.excludeAuthors.some(
        (v) => name.includes(v) || commit.author.email?.includes(v)
      )
    ) {
      continue;
    }

    if (_authors.has(name)) {
      const entry = _authors.get(name)!;
      if (commit.author.email) {
        entry.email.add(commit.author.email);
      }
    } else {
      _authors.set(name, {
        email: new Set([commit.author.email].filter(Boolean) as string[]),
      });
    }

    // Collect PR references for this author
    const refs = Array.isArray(commit.references) ? commit.references : [];
    for (const ref of refs) {
      if (ref?.type === "pull-request" && typeof ref.value === "string") {
        const num = Number.parseInt(ref.value.replace("#", ""), 10);
        if (Number.isFinite(num)) {
          if (!_authorPRs.has(name)) {
            _authorPRs.set(name, new Set());
          }
          _authorPRs.get(name)!.add(num);
        }
      }
    }
  }

  // Try to map authors to github usernames with new strategy
  await Promise.all(
    [..._authors.keys()].map(async (authorName) => {
      const meta = _authors.get(authorName)!;

      // 1) Prefer extracting login from noreply emails (local, privacy-safe)
      for (const email of meta.email) {
        const login = loginFromNoReply(email);
        if (login) {
          meta.github = login;
          break;
        }
      }
      if (meta.github) {
        return;
      }

      // 2) Fallback to ungh.cc for non-noreply emails
      for (const email of meta.email) {
        if (!email || email.includes("noreply.github.com")) continue;
        const { user } = await fetch(`https://ungh.cc/users/find/${email}`)
          .then((r) => r.json())
          .catch(() => ({ user: null }));
        if (user?.username) {
          meta.github = user.username;
          break;
        }
      }
      if (meta.github) {
        return;
      }

      // 3) Final fallback: use PR author login for any PRs referenced by this author's commits
      if (config.repo?.provider === "github") {
        const prs = [...(_authorPRs.get(authorName) || [])];
        for (const prNumber of prs) {
          const login = await getPullRequestAuthorLogin(config, prNumber).catch(
            () => undefined
          );
          if (login) {
            meta.github = login;
            break;
          }
        }
      }
    })
  );

  const authors = [..._authors.entries()].map((e) => ({ name: e[0], ...e[1] }));

  if (authors.length > 0 && !config.noAuthors) {
    markdown.push(
      "",
      "### " + "❤️ Contributors",
      "",
      ...authors.map((i) => {
        const _email = [...i.email].find(
          (e) => !e.includes("noreply.github.com")
        );
        const email =
          config.hideAuthorEmail !== true && _email ? ` <${_email}>` : "";
        const github = i.github
          ? ` ([@${i.github}](https://github.com/${i.github}))`
          : "";
        return `- ${i.name}${github || email || ""}`;
      })
    );
  }

  return convert(markdown.join("\n").trim(), true);
}

export function parseChangelogMarkdown(contents: string) {
  const headings = [...contents.matchAll(CHANGELOG_RELEASE_HEAD_RE)];
  const releases: { version?: string; body: string }[] = [];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const [, title] = heading;
    const version = title.match(VERSION_RE);
    const release = {
      version: version ? version[1] : undefined,
      body: contents
        .slice(
          heading.index + heading[0].length,
          nextHeading?.index ?? contents.length
        )
        .trim(),
    };
    releases.push(release);
  }

  return {
    releases,
  };
}

// --- Internal utils ---

function formatCommit(commit: GitCommit, config: ResolvedChangelogConfig) {
  return (
    "- " +
    (commit.scope ? `**${commit.scope.trim()}:** ` : "") +
    (commit.isBreaking ? "⚠️  " : "") +
    upperFirst(commit.description) +
    formatReferences(commit.references, config)
  );
}

function formatReferences(
  references: Reference[],
  config: ResolvedChangelogConfig
) {
  const pr = references.filter((ref) => ref.type === "pull-request");
  const issue = references.filter((ref) => ref.type === "issue");
  if (pr.length > 0 || issue.length > 0) {
    return (
      " (" +
      [...pr, ...issue]
        .map((ref) => formatReference(ref, config.repo))
        .join(", ") +
      ")"
    );
  }
  if (references.length > 0) {
    return " (" + formatReference(references[0], config.repo) + ")";
  }
  return "";
}

// function formatTitle (title: string = '') {
//   return title.length <= 3 ? title.toUpperCase() : upperFirst(title)
// }

function formatName(name = "") {
  return name
    .split(" ")
    .map((p) => upperFirst(p.trim()))
    .join(" ");
}

function groupBy(items: any[], key: string) {
  const groups = {};
  for (const item of items) {
    groups[item[key]] = groups[item[key]] || [];
    groups[item[key]].push(item);
  }
  return groups;
}

const CHANGELOG_RELEASE_HEAD_RE =
  /^#{2,}\s+.*(v?(\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?)).*$/gm;

const VERSION_RE = /^v?(\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?)$/;
