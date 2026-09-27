import { spawnSync } from 'node:child_process';

// Fixed commands only; this script never accepts shell fragments from arguments.
const tasks = [
  ['format'],
  ['format:check'],
  ['lint', 'apps/api'],
  ['lint', 'apps/web'],
  ['typecheck', 'apps/api'],
  ['typecheck', 'apps/web'],
  ['test', 'apps/api'],
  ['test', 'apps/web'],
  ['db:validate', 'apps/api'],
  ['test:integration', 'apps/api'],
  ['build', 'apps/api'],
  ['build', 'apps/web'],
  ['test:smoke'],
];
for (const [task, prefix] of tasks) {
  const args = ['run', task, ...(prefix ? ['--prefix', prefix] : [])];
  console.log(`\nVerifying: npm ${args.join(' ')}`);
  const result = spawnSync(
    process.platform === 'win32' ? 'cmd.exe' : 'npm',
    process.platform === 'win32' ? ['/d', '/s', '/c', `npm.cmd ${args.join(' ')}`] : args,
    {
      windowsHide: true,
      stdio: 'inherit',
    },
  );
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log('\nFull phase verification gate passed.');
