// `npm start` entry point.
// Production (NODE_ENV=production, e.g. DigitalOcean): run the compiled app
// from `npm run build`. `nest start` would compile TypeScript at boot, which
// runs a small instance out of memory before the server ever listens.
// Anywhere else: `nest start`, as before.
const { spawn } = require('child_process');
const path = require('path');

const production = (process.env.NODE_ENV || '').trim() === 'production';
const args = production
  ? [path.join(__dirname, '..', 'dist', 'src', 'main.js')]
  : [require.resolve('@nestjs/cli/bin/nest.js'), 'start', ...process.argv.slice(2)];

const child = spawn(process.execPath, args, { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
