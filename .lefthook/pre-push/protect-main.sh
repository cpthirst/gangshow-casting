#!/bin/sh
# Git sends one line per ref being pushed: <local ref> <local sha> <remote ref> <remote sha>.
# Block any push whose destination is main (covers `git push origin main` and `HEAD:main`).
while read -r local_ref local_sha remote_ref remote_sha; do
  if [ "$remote_ref" = "refs/heads/main" ]; then
    echo "Direct pushes to main are blocked. Push a branch and open a PR."
    exit 1
  fi
done
