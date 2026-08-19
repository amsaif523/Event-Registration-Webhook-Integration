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
      // script must NOT be the literal string 'serve' - that name is reserved
      // by PM2 and triggers its own built-in static server instead of the npm
      // `serve` package, ignoring these args entirely. Going through npx keeps
      // this unambiguous: it runs the real serve CLI with its real flags.
      name: 'eventide-frontend',
      cwd: '/home/abbas/apps/Event-Registration-Webhook-Integration/frontend',
      script: 'npx',
      args: 'serve -s dist -l 5007',
      interpreter: 'none',
    },
  ],
};
