module.exports = {
  apps: [
    {
      name: 'eventide-backend',
      cwd: '/home/abbas/apps/Event-Registration-Webhook-Integration/backend',
      script: 'php',
      args: '-S 127.0.0.1:4006 -t public public/index.php',
      interpreter: 'none',
    },
    {
      // 'serve' as a script name is reserved by PM2 - it does not exec the npm
      // `serve` package, it triggers PM2's own built-in static server, which
      // is configured through these PM2_SERVE_* env vars, not CLI args.
      name: 'eventide-frontend',
      cwd: '/home/abbas/apps/Event-Registration-Webhook-Integration/frontend',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: './dist',
        PM2_SERVE_PORT: 5006,
        PM2_SERVE_SPA: 'true',
      },
    },
  ],
};
