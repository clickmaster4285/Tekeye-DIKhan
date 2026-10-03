const path = require("path");

module.exports = {
  apps: [
    {
      name: "ml-services-gpu1",
      cwd: __dirname,
      script: "api_server.py",
      interpreter: path.join(__dirname, "venv", "bin", "python3"),
      env: {
        ML_API_HOST: "0.0.0.0",
        ML_API_PORT: "8101",
        ML_DEVICE: "0",
        CUDA_VISIBLE_DEVICES: "1",
        ML_PREFER_GPU: "true",
        ML_GPU_CPU_FALLBACK: "true",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
      kill_timeout: 8000,
    },
  ],
};
