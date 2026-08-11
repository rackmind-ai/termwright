import { chmod, lstat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform === 'win32') process.exit(0);

const nodePtyEntry = fileURLToPath(import.meta.resolve('node-pty'));
const nodePtyRoot = resolve(dirname(nodePtyEntry), '..');
const helper = join(
  nodePtyRoot,
  'prebuilds',
  `${process.platform}-${process.arch}`,
  'spawn-helper',
);

if (!helper.startsWith(`${nodePtyRoot}${sep}`)) {
  throw new Error('Refusing to modify a node-pty helper outside the dependency directory');
}

let metadata;
try {
  metadata = await lstat(helper);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    process.exit(0);
  }
  throw error;
}

if (!metadata.isFile() || metadata.isSymbolicLink()) {
  throw new Error(`Unexpected node-pty spawn-helper type at ${helper}`);
}

if ((metadata.mode & 0o111) === 0) {
  await chmod(helper, metadata.mode | 0o755);
  process.stdout.write('Termwright repaired node-pty spawn-helper permissions.\n');
}
