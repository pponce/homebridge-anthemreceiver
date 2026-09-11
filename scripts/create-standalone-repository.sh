#!/usr/bin/env bash
# Run in the NEW local checkout of release/anthemreceiver-plus, never the old checkout.
set -euo pipefail

target_repo='pponce/homebridge-anthemreceiver-plus'
target_url="https://github.com/${target_repo}.git"
source_base='341c167b3f95809f6e40a2b11a13ea40879fecd0'
for tool in git gh node; do
  command -v "$tool" >/dev/null || { echo "Install $tool before running this script." >&2; exit 1; }
done
task_root="$(git rev-parse --show-toplevel)"
cd "$task_root"
[[ "$(basename "$task_root")" == 'homebridge-anthemreceiver-plus' ]] || {
  echo 'Run this only from the new homebridge-anthemreceiver-plus checkout.' >&2; exit 1;
}
[[ -z "$(git status --porcelain)" ]] || { echo 'Commit or move local changes before setup.' >&2; exit 1; }
[[ "$(node -p 'require("./package.json").name')" == 'homebridge-anthemreceiver-plus' ]] || exit 1
git merge-base --is-ancestor "$source_base" HEAD || { echo 'Expected predecessor history is missing.' >&2; exit 1; }
gh auth status --hostname github.com
[[ "$(gh api user --jq .login)" == 'pponce' ]] || { echo 'Switch gh authentication to pponce first.' >&2; exit 1; }

task_tmp="$(mktemp -d)"
trap 'rm -rf "$task_tmp"' EXIT
if gh api "repos/$target_repo" >"$task_tmp/repo.json" 2>"$task_tmp/error"; then
  node - "$task_tmp/repo.json" <<'NODE'
const fs = require('node:fs');
const repo = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (repo.full_name !== 'pponce/homebridge-anthemreceiver-plus' || repo.fork || repo.private) {
  throw new Error('Existing destination must be the public standalone Plus repository. No settings were changed.');
}
NODE
else
  if ! grep -q 'HTTP 404' "$task_tmp/error"; then cat "$task_tmp/error" >&2; exit 1; fi
  gh repo create "$target_repo" --public --description 'Maintained Anthem receiver integration for Homebridge, with compatible accessory migration.'
fi

# Accept an empty destination or an exact repeat of this already-pushed setup.
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' ls-remote --heads "$target_url" >"$task_tmp/heads"
if [[ -s "$task_tmp/heads" ]]; then
  expected="$(git rev-parse HEAD)"
  if [[ "$(wc -l <"$task_tmp/heads" | tr -d ' ')" != 1 ]] ||
     ! awk -v sha="$expected" '$1 == sha && $2 == "refs/heads/main" { found=1 } END { exit !found }' "$task_tmp/heads"; then
    echo 'Destination already contains other history. Stopping without changing it; do not force-push.' >&2; exit 1;
  fi
fi

current_origin="$(git remote get-url origin)"
case "$current_origin" in
  https://github.com/pponce/homebridge-anthemreceiver.git|git@github.com:pponce/homebridge-anthemreceiver.git)
    git remote rename origin history-source
    git remote set-url --push history-source 'disabled://history-source'
    git remote add origin "$target_url"
    ;;
  "$target_url"|git@github.com:pponce/homebridge-anthemreceiver-plus.git) ;;
  *) echo "Unexpected origin: $current_origin" >&2; exit 1 ;;
esac
if [[ "$(git branch --show-current)" != main ]]; then
  git show-ref --verify --quiet refs/heads/main && { echo 'A local main branch already exists; inspect it first.' >&2; exit 1; }
  git branch -m main
fi
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push --set-upstream origin main
gh repo edit "$target_repo" --default-branch main --enable-issues
gh api "repos/$target_repo" --jq '{repository: .full_name, fork: .fork, default_branch: .default_branch, issues: .has_issues}'
echo "Created standalone project: https://github.com/$target_repo"
echo "New local checkout: $task_root"
echo 'The previous local checkout and repository are retained. No live Homebridge installation or npm release was changed.'
echo "Check CI: gh run list --repo $target_repo --branch main"

