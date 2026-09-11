#!/usr/bin/env bash
# Explicit second stage: publishes the prepared candidate to npm's beta tag.
set -euo pipefail
for tool in git gh node npm; do command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 1; }; done
cd "$(git rev-parse --show-toplevel)"
target_repo='pponce/homebridge-anthemreceiver-plus'
package_name="$(node -p 'require("./package.json").name')"
version="$(node -p 'require("./package.json").version')"
[[ "$package_name" == 'homebridge-anthemreceiver-plus' && "$version" == *-beta.* ]] || {
  echo 'This script only publishes Anthem Receiver Plus beta versions.' >&2; exit 1;
}
[[ "$(git branch --show-current)" == main && -z "$(git status --porcelain)" ]] || {
  echo 'Use the clean main branch of the standalone repository.' >&2; exit 1;
}
case "$(git remote get-url origin)" in
  https://github.com/pponce/homebridge-anthemreceiver-plus.git|git@github.com:pponce/homebridge-anthemreceiver-plus.git) ;;
  *) echo 'Origin is not the standalone Plus repository.' >&2; exit 1 ;;
esac
gh auth status --hostname github.com
npm whoami
head_sha="$(git rev-parse HEAD)"
remote_sha="$(gh api "repos/$target_repo/commits/main" --jq .sha)"
[[ "$head_sha" == "$remote_sha" ]] || { echo 'Local main must match GitHub main before publication.' >&2; exit 1; }
ci="$(gh api "repos/$target_repo/actions/workflows/build.yml/runs?head_sha=$head_sha&branch=main&per_page=20" --jq '[.workflow_runs[] | select(.event == "push" or .event == "workflow_dispatch")][0].conclusion // "pending"')"
[[ "$ci" == success ]] || { echo "CI for this commit is $ci; inspect Actions before publishing." >&2; exit 1; }

# Match the current CI installation policy; lockfile adoption is tracked separately.
npm install --ignore-scripts --package-lock=false
npm run lint
npm test
npm run test:migration
npm run check:package

task_tmp="$(mktemp -d)"
trap 'rm -rf "$task_tmp"' EXIT
npm pack --ignore-scripts --json --pack-destination "$task_tmp" >"$task_tmp/pack.json"
archive_name="$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))[0].filename' "$task_tmp/pack.json")"
integrity="$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))[0].integrity' "$task_tmp/pack.json")"

if npm view "$package_name@$version" dist.integrity --json --prefer-online >"$task_tmp/existing.json" 2>"$task_tmp/npm-error"; then
  published_integrity="$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$task_tmp/existing.json")"
  [[ "$published_integrity" == "$integrity" ]] || {
    echo 'This version already exists with different package contents. Choose a new version; do not overwrite it.' >&2; exit 1;
  }
  echo 'The identical beta package is already published; continuing with release checks.'
else
  grep -q 'E404' "$task_tmp/npm-error" || { cat "$task_tmp/npm-error" >&2; exit 1; }
  npm publish "$task_tmp/$archive_name" --access public --tag beta
fi

npm view "$package_name@$version" dist.integrity --json --prefer-online >"$task_tmp/published.json"
published_integrity="$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$task_tmp/published.json")"
[[ "$published_integrity" == "$integrity" ]] || { echo 'Published package integrity did not match; stop and inspect npm.' >&2; exit 1; }
beta_version="$(npm view "$package_name" dist-tags.beta --prefer-online)"
[[ "$beta_version" == "$version" ]] || {
  echo "npm beta points to $beta_version, not $version. Inspect dist-tags before changing them." >&2; exit 1;
}

tag="v$version"
if gh api "repos/$target_repo/git/ref/tags/$tag" >"$task_tmp/tag.json" 2>"$task_tmp/tag-error"; then
  [[ "$(gh api "repos/$target_repo/commits/$tag" --jq .sha)" == "$head_sha" ]] || {
    echo 'The existing release tag points to a different commit.' >&2; exit 1;
  }
else
  grep -q 'HTTP 404' "$task_tmp/tag-error" || { cat "$task_tmp/tag-error" >&2; exit 1; }
fi
if gh release view "$tag" --repo "$target_repo" >/dev/null 2>&1; then
  gh release view "$tag" --repo "$target_repo"
else
  gh release create "$tag" --repo "$target_repo" --target "$head_sha" --prerelease \
    --title "Anthem Receiver Plus $version" --notes-file RELEASE_NOTES_BETA.md
fi
echo "Published $package_name@$version under npm tag beta and GitHub prerelease $tag."
echo 'This script does not install the plugin into Homebridge or submit a verification request.'

