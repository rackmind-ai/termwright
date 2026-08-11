#!/usr/bin/env node

import('../dist/index.js')
  .then(({ main }) => main(process.argv.slice(2)))
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`termwright: ${message}\n`);
    process.exitCode = 1;
  });
