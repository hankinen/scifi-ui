#!/bin/sh

if [ -z $1 ]
then
  echo "[INFO] No test names provided."
  echo "[INFO] Tests names can be provided as first parameter separated by comma."
  echo "[INFO] Using all available performance tests."
  pnpm exec cross-env NODE_ENV=production webpack --progress
else
  echo "[INFO] Building performance tests \"$1\"..."
  pnpm exec cross-env NODE_ENV=production TEST_NAMES=$1 webpack --progress
  echo "[SUCCESS] Tests \"$1\" were built."
fi
