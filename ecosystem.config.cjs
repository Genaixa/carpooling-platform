module.exports = {
  apps: [
    {
      name: 'payment-server',
      script: 'server/index.js',
      cwd: '/root/carpooling-platform',
      env_file: '.env'
    }
  ]
};
