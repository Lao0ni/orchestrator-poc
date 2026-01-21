import type { GitHubFileChecker, Context } from '../core/types.js';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

export async function checkGitHubFile(config: GitHubFileChecker, ctx: Context): Promise<boolean> {
  const path = typeof config.path === 'function' ? config.path(ctx) : config.path;
  const branch = config.branch ?? 'main';
  const url = `${GITHUB_RAW_BASE}/${config.repo}/${branch}/${path}`;

  try {
    const response = await fetch(url);

    if (response.status !== 200) {
      console.log(`[github-file] File not found: ${url}`);
      return false;
    }

    // If no content check, just verify file exists
    if (!config.contentCheck) {
      return true;
    }

    // Parse and validate content
    const content = await response.json();
    return config.contentCheck(content, ctx);
  } catch (error) {
    console.error(`[github-file] Check failed for ${url}:`, error);
    return false;
  }
}

export async function fetchGitHubFile<T = unknown>(
  repo: string,
  path: string,
  branch = 'main'
): Promise<T | null> {
  const url = `${GITHUB_RAW_BASE}/${repo}/${branch}/${path}`;

  try {
    const response = await fetch(url);
    if (response.status !== 200) {
      return null;
    }
    return response.json() as Promise<T>;
  } catch (error) {
    console.error(`[github-file] Fetch failed for ${url}:`, error);
    return null;
  }
}

export async function checkGitHubFileExists(
  repo: string,
  path: string,
  branch = 'main'
): Promise<boolean> {
  const url = `${GITHUB_RAW_BASE}/${repo}/${branch}/${path}`;

  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.status === 200;
  } catch {
    return false;
  }
}
