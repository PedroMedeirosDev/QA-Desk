import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type {
  GithubPrCommit,
  GithubPrDetail,
  GithubPullRequestSnapshot,
  GithubPrReview,
} from "./kb-pr-sync-core.js";

const execFileAsync = promisify(execFile);

/** Chunk de aliases GraphQL — evita query gigante / complexity limit. */
const GRAPHQL_PR_CHUNK = 20;

function parseRepo(repository: string): { owner: string; name: string } {
  const [owner, name] = repository.split("/");
  if (!owner || !name) {
    throw new Error(`Repositório inválido: ${repository}`);
  }
  return { owner, name };
}

async function ghJson(args: string[], maxBuffer = 4 * 1024 * 1024): Promise<unknown> {
  const { stdout } = await execFileAsync("gh", args, {
    windowsHide: true,
    maxBuffer,
  });
  return JSON.parse(stdout) as unknown;
}

async function ghGraphql(
  query: string,
  variables: Record<string, string>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", ["api", "graphql", "--input", "-"], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `gh api graphql exit ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.write(JSON.stringify({ query, variables }));
    child.stdin.end();
  });
}

export async function listPullRequests(
  repository: string,
  limit = 200,
): Promise<GithubPullRequestSnapshot[]> {
  const data = await ghJson([
    "pr",
    "list",
    "--repo",
    repository,
    "--state",
    "all",
    "--limit",
    String(limit),
    "--json",
    "number,title,url,state,createdAt,updatedAt,mergedAt,mergeCommit",
  ]);
  return data as GithubPullRequestSnapshot[];
}

export async function fetchPullRequestSnapshot(
  repository: string,
  prNumber: number,
): Promise<GithubPullRequestSnapshot> {
  const data = await ghJson([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repository,
    "--json",
    "number,title,url,state,createdAt,updatedAt,mergedAt,mergeCommit",
  ]);
  return data as GithubPullRequestSnapshot;
}

type GraphqlPrNode = {
  number: number;
  reviews?: {
    nodes?: Array<{
      state?: string;
      submittedAt?: string;
      author?: { login?: string } | null;
    }>;
  };
  commits?: {
    nodes?: Array<{
      commit?: {
        oid?: string;
        committedDate?: string;
        messageHeadline?: string;
        authors?: {
          nodes?: Array<{
            user?: { login?: string } | null;
            name?: string;
            email?: string;
          }>;
        };
      };
    }>;
  };
};

function mapGraphqlDetail(node: GraphqlPrNode | null | undefined): GithubPrDetail | undefined {
  if (!node) return undefined;

  const reviews: GithubPrReview[] = (node.reviews?.nodes ?? [])
    .filter((review) => review.submittedAt && review.state)
    .map((review) => ({
      state: review.state as string,
      submittedAt: review.submittedAt as string,
      author: review.author ? { login: review.author.login } : null,
    }));

  const commits: GithubPrCommit[] = (node.commits?.nodes ?? [])
    .map((entry) => entry.commit)
    .filter(Boolean)
    .map((commit) => ({
      oid: commit!.oid ?? "",
      committedDate: commit!.committedDate ?? "",
      messageHeadline: commit!.messageHeadline,
      authors: (commit!.authors?.nodes ?? []).map((author) => ({
        login: author.user?.login,
        name: author.name,
        email: author.email,
      })),
    }))
    .filter((commit) => commit.oid && commit.committedDate);

  return { commits, reviews };
}

const PR_DETAIL_FRAGMENT = `
  number
  reviews(last: 40) {
    nodes {
      state
      submittedAt
      author { login }
    }
  }
  commits(last: 50) {
    nodes {
      commit {
        oid
        committedDate
        messageHeadline
        authors(first: 5) {
          nodes {
            user { login }
            name
            email
          }
        }
      }
    }
  }
`;

async function fetchPrDetailsChunk(
  owner: string,
  name: string,
  numbers: number[],
): Promise<Map<number, GithubPrDetail>> {
  const aliases = numbers
    .map(
      (prNumber, index) =>
        `p${index}: pullRequest(number: ${prNumber}) { ${PR_DETAIL_FRAGMENT} }`,
    )
    .join("\n");

  const query = `query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      ${aliases}
    }
  }`;

  const payload = await ghGraphql(query, { owner, name });

  const root = payload as {
    data?: { repository?: Record<string, GraphqlPrNode | null> };
    errors?: Array<{ message?: string }>;
  };

  if (root.errors?.length) {
    const message = root.errors.map((error) => error.message).filter(Boolean).join("; ");
    throw new Error(message || "GraphQL errors");
  }

  const repo = root.data?.repository ?? {};
  const out = new Map<number, GithubPrDetail>();
  for (const [index, prNumber] of numbers.entries()) {
    const detail = mapGraphqlDetail(repo[`p${index}`]);
    if (detail) out.set(prNumber, detail);
  }
  return out;
}

/**
 * Busca reviews+commits de vários PRs em poucas queries GraphQL (em vez de N× `gh pr view`).
 */
export async function fetchPrDetailsBatch(
  repository: string,
  prNumbers: number[],
): Promise<Map<number, GithubPrDetail>> {
  if (prNumbers.length === 0) return new Map();

  const { owner, name } = parseRepo(repository);
  const unique = [...new Set(prNumbers)].sort((a, b) => a - b);
  const out = new Map<number, GithubPrDetail>();

  for (let i = 0; i < unique.length; i += GRAPHQL_PR_CHUNK) {
    const chunk = unique.slice(i, i + GRAPHQL_PR_CHUNK);
    const part = await fetchPrDetailsChunk(owner, name, chunk);
    for (const [prNumber, detail] of part) out.set(prNumber, detail);
  }

  return out;
}

export async function fetchPrDetail(
  repository: string,
  prNumber: number,
): Promise<GithubPrDetail> {
  const map = await fetchPrDetailsBatch(repository, [prNumber]);
  return map.get(prNumber) ?? { commits: [], reviews: [] };
}
