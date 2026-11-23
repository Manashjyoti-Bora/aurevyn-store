/**
 * Whether this deployment is allowed to appear in search results.
 *
 * Why this exists: a Vercel **Preview** deployment is served from its own public
 * hostname (`<project>-git-<branch>-<team>.vercel.app` or a per-deployment id).
 * Every route is fully rendered there, so a crawler that finds one preview URL
 * can index a second copy of the whole store. Duplicate copies on hostnames
 * nobody maintains compete with the real domain and dilute the pages the owner
 * actually wants ranked — the same class of problem as a stale canonical.
 *
 * The rule is deliberately narrow: only a Vercel `production` deployment is
 * indexable; `preview` and `development` are not. Outside Vercel (local dev,
 * self-hosting, unit tests) nothing changes — there is no separate preview tier
 * to tell apart, and those hosts are not crawled.
 *
 * Pure so it can be unit tested without a build or a request.
 */
export function isIndexableDeployment(vercelEnv?: string | null): boolean {
  const scope = vercelEnv?.trim().toLowerCase();
  if (!scope) return true;
  return scope === 'production';
}
