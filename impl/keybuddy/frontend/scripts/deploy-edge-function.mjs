import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, '..');
const projectDir = resolve(frontendDir, '..');
const projectRef = process.env.SUPABASE_PROJECT_REF || 'kzgrduvwwoflybrqayyk';

function executable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(executable('npm'), ['run', 'build']);
run(executable('supabase'), [
  'functions',
  'deploy',
  'recommend',
  '--workdir',
  projectDir,
  '--project-ref',
  projectRef,
  '--use-api',
]);
