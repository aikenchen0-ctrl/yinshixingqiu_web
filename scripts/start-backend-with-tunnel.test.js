const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTunnelSshArgs,
  buildBackendLaunchSpec,
  shouldUseTunnelForPlatform,
} = require('./start-backend-with-tunnel');

test('Windows 平台应启用数据库 SSH 隧道', () => {
  assert.equal(shouldUseTunnelForPlatform('win32'), true);
  assert.equal(shouldUseTunnelForPlatform('linux'), false);
});

test('应构造正确的 SSH 隧道参数', () => {
  const args = buildTunnelSshArgs({
    localPort: 15432,
    remoteUser: 'root',
    remoteHost: '112.74.164.233',
    remotePort: 5432,
  });

  assert.deepEqual(args, [
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
    '15432:127.0.0.1:5432',
    'root@112.74.164.233',
  ]);
});

test('应直接使用当前 Node 进程启动 backend 服务', () => {
  const winSpec = buildBackendLaunchSpec('win32');
  const linuxSpec = buildBackendLaunchSpec('linux');

  assert.equal(winSpec.command, process.execPath);
  assert.deepEqual(winSpec.args, ['src/server.js']);
  assert.equal(winSpec.options.stdio, 'inherit');

  assert.equal(linuxSpec.command, process.execPath);
  assert.deepEqual(linuxSpec.args, ['src/server.js']);
  assert.equal(linuxSpec.options.stdio, 'inherit');
});
