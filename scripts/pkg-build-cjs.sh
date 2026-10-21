#!/bin/sh

mkdir -p ./build/cjs
echo "{ \"type\": \"commonjs\" }" >| ./build/cjs/package.json
pnpm exec tsc -p ./tsconfig.build.cjs.json $1
