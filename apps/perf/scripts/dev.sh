#!/bin/sh

if [ -z $1 ]
then
  echo "[INFO] No test names provided."
  echo "[INFO] Tests names can be provided as first parameter separated by comma."
  echo "[INFO] Using all available performance tests."
  pnpm exec webpack serve
else
  echo "[INFO] Building and watching performance tests \"$1\"..."
  pnpm exec cross-env TEST_NAMES=$1 webpack serve
fi
