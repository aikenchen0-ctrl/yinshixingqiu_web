module.exports = {
  apps: [
    {
      name: "xueyin-backend",
      cwd: "/var/www/xueyin/backend",
      script: "src/server.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      out_file: "/var/log/xueyin/backend.out.log",
      error_file: "/var/log/xueyin/backend.err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
