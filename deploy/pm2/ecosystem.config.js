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
      name: 'eventide-frontend',
      cwd: '/home/abbas/apps/Event-Registration-Webhook-Integration/frontend',
      script: 'serve',
      args: '-s dist -l 5006',
      interpreter: 'none',
    },
  ],
};
