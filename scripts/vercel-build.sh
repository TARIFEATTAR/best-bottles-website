#!/bin/sh
# For Preview builds: skip Convex deploy (use existing production backend).
# For Production builds: run full Convex deploy + Next.js build.
# Only deploy Convex when: production env AND deploying main branch.
set -e
if [ "$VERCEL_ENV" = "production" ] && [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  npx convex deploy --cmd 'npx next build --webpack'
else
  npx next build --webpack
fi
