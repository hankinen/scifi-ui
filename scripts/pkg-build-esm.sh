#!/bin/sh

mkdir -p ./build/esm
echo "{ \"type\": \"module\" }" >| ./build/esm/package.json
pnpm exec tsc -p ./tsconfig.build.esm.json $1
