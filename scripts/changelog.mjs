#!/usr/bin/env node
// Tidewake — dual sprint changelog generator (human .md + machine .json).
//
// Zero deps: only node:child_process + node:fs. Parses `git log BASE..HEAD`, enriches each commit
// (conventional-commit prefix -> type; `#\d+` -> issues; `--name-only` -> files/slice; release tag via
// `git tag --contains`), groups by primary issue, and writes:
//   docs/runbook/changelogs/CHANGELOG-<sprint>.md   (PM-desk voice: player-value line + footer)
//   docs/runbook/changelogs/changelog-<sprint>.json (machine schema; see README/SPRINT.md)
//
// Usage:  node scripts/changelog.mjs <base> <head> <sprint_id>
// Optional env: SPRINT_COST_USD (number), SPRINT_METRICS (raw JSON object merged at top level).

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const [, , BASE, HEAD, SPRINT_ID] = process.argv;
if (!BASE || !HEAD || !SPRINT_ID) {
  console.error('usage: node scripts/changelog.mjs <base> <head> <sprint_id>');
  process.exit(2);
}

const OUT_DIR = 'docs/runbook/changelogs';

// --- tiny git helpers -------------------------------------------------------
function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return '';
  }
}

// Repo slug (owner/name) from the origin remote, for GitHub URLs.
function repoSlug() {
  const url = git(['config', '--get', 'remote.origin.url']).trim();
  // git@github.com:cakuki/tidewake.git  |  https://github.com/cakuki/tidewake.git
  const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
  return m ? m[1] : 'cakuki/tidewake';
}
const SLUG = repoSlug();

// --- enrichment -------------------------------------------------------------
const CC_RE = /^(feat|fix|docs|chore|refactor|test|perf|style|build|ci|revert)(\([^)]*\))?(!)?:\s*/;

function typeOf(subject) {
  const m = subject.match(CC_RE);
  return m ? m[1] : 'other';
}
function stripPrefix(subject) {
  return subject.replace(CC_RE, '').trim() || subject.trim();
}
function issuesIn(text) {
  const out = new Set();
  for (const m of text.matchAll(/#(\d+)/g)) out.add(Number(m[1]));
  return [...out];
}
function filesOf(sha) {
  return git(['show', '--name-only', '--pretty=format:', sha])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
// Drop git trailers (Co-Authored-By:, Signed-off-by:) so the PM-desk body reads clean.
function cleanBody(body) {
  return body
    .split('\n')
    .filter((l) => !/^(co-authored-by|signed-off-by|co-developed-by):/i.test(l.trim()))
    .join('\n')
    .trim();
}
// Slice = dominant meaningful path segment across the touched files (editorial but deterministic).
function sliceOf(files) {
  const tally = new Map();
  for (const f of files) {
    const parts = f.split('/');
    let key;
    if (parts[0] === 'src' && parts.length > 2) key = parts.slice(0, 2).join('/'); // src/systems
    else if (parts[0] === 'src') key = 'src';
    else if (parts[0] === 'index.html') key = 'index';
    else key = parts[0] || 'misc';
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  let best = '-';
  let n = -1;
  for (const [k, v] of tally) if (v > n) { best = k; n = v; }
  return best.replace(/^src\//, '');
}
function releaseTagOf(sha) {
  const tags = git(['tag', '--contains', sha]).split('\n').map((s) => s.trim()).filter(Boolean);
  return tags.find((t) => /^v\d/.test(t)) || tags[0] || null;
}
function isPlayerFacing(type, files) {
  if (type !== 'feat' && type !== 'fix' && type !== 'perf') return false;
  return files.some((f) => f.startsWith('src/') || f === 'index.html');
}

// --- read the commit range --------------------------------------------------
const RS = '\x1e'; // record separator
const FS = '\x1f'; // field separator
const raw = git(['log', '--no-merges', `--pretty=format:%H${FS}%h${FS}%s${FS}%b${FS}%an${FS}%aI${RS}`, `${BASE}..${HEAD}`]);

const commits = raw
  .split(RS)
  .map((r) => r.replace(/^\n/, ''))
  .filter((r) => r.trim())
  .map((rec) => {
    const [sha, short, subject, body, author, date] = rec.split(FS);
    const files = filesOf(sha);
    const type = typeOf(subject);
    return {
      sha,
      short,
      subject: subject || '',
      body: cleanBody(body || ''),
      author: author || '',
      date: date || '',
      files,
      type,
      slice: sliceOf(files),
      issues: issuesIn(`${subject} ${body}`),
      release_tag: releaseTagOf(sha),
      player_facing: isPlayerFacing(type, files),
    };
  });

// --- group commits into entries (by primary issue; else one entry per commit)
const entries = [];
const byIssue = new Map();
for (const c of commits) {
  const key = c.issues.length ? `#${c.issues[0]}` : null;
  if (key) {
    if (!byIssue.has(key)) byIssue.set(key, []);
    byIssue.get(key).push(c);
  } else {
    entries.push([c]);
  }
}
for (const group of byIssue.values()) entries.push(group);

// Keep entries in commit order (newest first, matching git log default).
function firstIndex(group) {
  return commits.indexOf(group[0]);
}
entries.sort((a, b) => firstIndex(a) - firstIndex(b));

// Pick the most significant commit as the entry's representative (feat > fix > perf > refactor > …).
const TYPE_RANK = { feat: 0, fix: 1, perf: 2, refactor: 3, build: 4, ci: 5, test: 6, docs: 7, chore: 8, style: 9, revert: 10, other: 11 };
function representative(group) {
  return [...group].sort((a, b) => (TYPE_RANK[a.type] ?? 99) - (TYPE_RANK[b.type] ?? 99))[0];
}

function buildEntry(group) {
  const files = [...new Set(group.flatMap((c) => c.files))];
  const issues = [...new Set(group.flatMap((c) => c.issues))].sort((a, b) => a - b);
  const rep = representative(group);
  const type = rep.type;
  const slice = sliceOf(files);
  const release_tag = group.map((c) => c.release_tag).find(Boolean) || null;
  const player_facing = group.some((c) => c.player_facing);
  const title = stripPrefix(rep.subject);
  // PM-desk body: prefer the representative's body, else the richest body, else the stripped subject.
  const body =
    rep.body ||
    group.map((c) => c.body).filter(Boolean).sort((a, b) => b.length - a.length)[0] ||
    title;
  return {
    title,
    body,
    type,
    slice,
    issues,
    commits: group.map((c) => c.short),
    commit_urls: group.map((c) => `https://github.com/${SLUG}/commit/${c.sha}`),
    release_tag,
    files,
    player_facing,
  };
}

const builtEntries = entries.map(buildEntry);

// --- timestamps -------------------------------------------------------------
const dates = commits.map((c) => c.date).filter(Boolean).sort();
const started_at = dates[0] || new Date().toISOString();
const ended_at = dates[dates.length - 1] || new Date().toISOString();

// --- optional cost + metrics passthrough ------------------------------------
let cost_usd = null;
if (process.env.SPRINT_COST_USD && !Number.isNaN(Number(process.env.SPRINT_COST_USD))) {
  cost_usd = Number(process.env.SPRINT_COST_USD);
}
let metrics = null;
if (process.env.SPRINT_METRICS) {
  try { metrics = JSON.parse(process.env.SPRINT_METRICS); } catch { metrics = null; }
}

// --- machine artifact -------------------------------------------------------
const json = {
  sprint_id: SPRINT_ID,
  base_sha: git(['rev-parse', BASE]).trim() || BASE,
  head_sha: git(['rev-parse', HEAD]).trim() || HEAD,
  compare_url: `https://github.com/${SLUG}/compare/${BASE}...${HEAD}`,
  started_at,
  ended_at,
  cost_usd,
  entries: builtEntries,
};
if (metrics) json.metrics = metrics;

// --- human artifact (PM-desk voice) -----------------------------------------
function footer(e) {
  const bits = [];
  if (e.issues.length) bits.push(e.issues.map((i) => `#${i}`).join(', '));
  if (e.slice && e.slice !== '-') bits.push(`slice: ${e.slice}`);
  if (e.release_tag) bits.push(`tag \`${e.release_tag}\``);
  if (e.commits.length) bits.push(e.commits.map((s) => `\`${s}\``).join(', '));
  return `— ${bits.join(' · ')}`;
}
const shipped = builtEntries.filter((e) => e.player_facing).length;
const shortDate = SPRINT_ID.replace(/:\d{2}(\.\d+)?Z?$/, 'Z').replace(/Z$/, 'Z');
const lines = [];
lines.push(`# Tidewake — Sprint ${shortDate}  (${shipped} slice${shipped === 1 ? '' : 's'} shipped)`);
lines.push('');
lines.push(`Range [\`${json.base_sha.slice(0, 7)}\`…\`${json.head_sha.slice(0, 7)}\`](${json.compare_url}) · ${builtEntries.length} entr${builtEntries.length === 1 ? 'y' : 'ies'}` +
  (cost_usd != null ? ` · cost $${cost_usd.toFixed(2)}` : ''));
lines.push('');
if (builtEntries.length === 0) {
  lines.push('_No commits in this range — the sprint made no changes._');
} else {
  for (const e of builtEntries) {
    const anchor = e.player_facing ? '⚓ ' : '';
    lines.push(`## ${anchor}${e.title}`);
    lines.push(e.body);
    lines.push(footer(e));
    lines.push('');
  }
}

// --- write ------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
const mdPath = `${OUT_DIR}/CHANGELOG-${SPRINT_ID}.md`;
const jsonPath = `${OUT_DIR}/changelog-${SPRINT_ID}.json`;
writeFileSync(mdPath, lines.join('\n') + '\n');
writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n');

console.log(`changelog: wrote ${mdPath} + ${jsonPath} (${builtEntries.length} entries, ${commits.length} commits)`);
