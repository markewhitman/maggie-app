// ============================================================
// GitHub API Integration — PDF Upload / Download
// ============================================================
// PDFs are stored as GitHub Release Assets on a dedicated
// release tag (e.g. "pdf-storage") in the user's repo.
// All operations use the GitHub REST API v3.
// ============================================================

export interface GithubRelease {
  id: number;
  tag_name: string;
  upload_url: string;
}

export interface GithubAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
}

// ─── Fetch helpers ────────────────────────────────────────

async function ghFetch(
  url: string,
  pat: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  return res;
}

// ─── Get or Create Release ───────────────────────────────

export async function getOrCreateRelease(
  owner: string,
  repo: string,
  pat: string,
  tag = "pdf-storage"
): Promise<GithubRelease> {
  // Try to get existing release
  const getRes = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
    pat
  );

  if (getRes.ok) {
    return getRes.json() as Promise<GithubRelease>;
  }

  // Create it
  const createRes = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/releases`,
    pat,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag_name: tag,
        name: "PDF Storage",
        body: "Maggie App — PDF tab/sheet music storage. Do not delete.",
        draft: false,
        prerelease: false,
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create release: ${err}`);
  }

  return createRes.json() as Promise<GithubRelease>;
}

// ─── Upload PDF ───────────────────────────────────────────

export async function uploadPdf(
  owner: string,
  repo: string,
  pat: string,
  file: File,
  songId: string
): Promise<GithubAsset> {
  const release = await getOrCreateRelease(owner, repo, pat);

  // Sanitize filename: prefix with songId to avoid collisions
  const safeName = `${songId}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // Delete existing asset with same name if present
  const existing = await listReleaseAssets(owner, repo, pat, release.id);
  const dupe = existing.find((a) => a.name === safeName);
  if (dupe) {
    await deleteAsset(owner, repo, pat, dupe.id);
  }

  // Build upload URL (strip template params)
  const uploadUrl = release.upload_url.replace(/\{[^}]+\}/g, "");

  const res = await fetch(`${uploadUrl}?name=${encodeURIComponent(safeName)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/pdf",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${err}`);
  }

  return res.json() as Promise<GithubAsset>;
}

// ─── List Release Assets ──────────────────────────────────

export async function listReleaseAssets(
  owner: string,
  repo: string,
  pat: string,
  releaseId: number
): Promise<GithubAsset[]> {
  const res = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`,
    pat
  );
  if (!res.ok) return [];
  return res.json() as Promise<GithubAsset[]>;
}

// ─── Delete Asset ─────────────────────────────────────────

export async function deleteAsset(
  owner: string,
  repo: string,
  pat: string,
  assetId: number
): Promise<void> {
  await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`,
    pat,
    { method: "DELETE" }
  );
}

// ─── Validate PAT ─────────────────────────────────────────

export async function validatePat(pat: string): Promise<{ valid: boolean; login?: string }> {
  const res = await ghFetch("https://api.github.com/user", pat);
  if (!res.ok) return { valid: false };
  const data = (await res.json()) as { login: string };
  return { valid: true, login: data.login };
}

// ─── List User Repos ──────────────────────────────────────

export async function listRepos(pat: string): Promise<{ name: string; full_name: string; owner: { login: string } }[]> {
  const res = await ghFetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    pat
  );
  if (!res.ok) return [];
  return res.json();
}
