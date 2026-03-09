#!/bin/sh
# For Preview builds: skip Convex deploy (use existing production backend).
# For Production builds: run full Convex deploy + Next.js build.
set -e
if [ "$VERCEL_ENV" = "production" ]; then
  npx convex deploy --cmd 'npm run build'
else
  npm run build
fi
