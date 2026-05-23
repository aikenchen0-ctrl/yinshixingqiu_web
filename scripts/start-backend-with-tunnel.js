const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function shouldUseTunnelForPlatform(platform) {
  return platform === 'win32';
}

function buildTunnelSshArgs({ localPort, remoteUser, remoteHost, remotePort }) {
  return [
    '-f',
    '-N',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=30',
    '-o',
    'ServerAliveCountMax=3',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-L',
    `${localPort}:127.0.0.1:${remotePort}`,
    `${remoteUser}@${remoteHost}`,
  ];
}

function isPortOpen(port, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });

    const finalize = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
  });
}

async function waitForPortOpen(port, host, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortOpen(port, host)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

function getTunnelConfig() {
  return {
    localPort: Number(process.env.XUEYIN_DB_TUNNEL_LOCAL_PORT || 15432),
    remoteUser: process.env.XUEYIN_DB_TUNNEL_REMOTE_USER || 'root',
    remoteHost: process.env.XUEYIN_DB_TUNNEL_REMOTE_HOST || '112.74.164.233',
    remotePort: Number(process.env.XUEYIN_DB_TUNNEL_REMOTE_PORT || 5432),
    sshCommand: process.env.XUEYIN_DB_TUNNEL_SSH_COMMAND || 'ssh',
  };
}

function startTunnelProcess(config) {
  const sshArgs = buildTunnelSshArgs(config);
  const result = spawnSync(config.sshCommand, sshArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`SSH tunnel exited with status ${String(result.status)}`);
  }
}

async function ensureTunnelReady(platform = process.platform) {
  if (!shouldUseTunnelForPlatform(platform)) {
    return;
  }

  const config = getTunnelConfig();
  const localHost = '127.0.0.1';

  if (await isPortOpen(config.localPort, localHost)) {
    console.log(`[start] reuse existing db tunnel on ${localHost}:${config.localPort}`);
    return;
  }

  console.log(
    `[start] opening db tunnel ${localHost}:${config.localPort} -> ${config.remoteHost}:127.0.0.1:${config.remotePort}`,
  );
  startTunnelProcess(config);

  const tunnelReady = await waitForPortOpen(config.localPort, localHost, 15000);
  if (!tunnelReady) {
    throw new Error(`Database tunnel was not ready on ${localHost}:${config.localPort} within 15000ms`);
  }
}

function buildBackendLaunchSpec(platform = process.platform) {
  const backendCwd = path.join(__dirname, '..', 'backend');

  return {
    command: process.execPath,
    args: ['src/server.js'],
    options: {
      cwd: backendCwd,
      stdio: 'inherit',
    },
  };
}

function startBackendProcess(platform = process.platform) {
  const launchSpec = buildBackendLaunchSpec(platform);
  console.log(`[start] launching backend with ${path.relative(process.cwd(), launchSpec.options.cwd) || 'backend'}`);

  const child = spawn(launchSpec.command, launchSpec.args, launchSpec.options);

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code || 0);
  });

  child.on('error', (error) => {
    console.error('[start] failed to launch backend:', error);
    process.exit(1);
  });
}

async function main() {
  await ensureTunnelReady(process.platform);
  startBackendProcess(process.platform);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[start] failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = {
  buildBackendLaunchSpec,
  buildTunnelSshArgs,
  ensureTunnelReady,
  shouldUseTunnelForPlatform,
};
