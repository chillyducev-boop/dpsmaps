module.exports = {
  apps: [
    {
      name: "dpsmap",
      script: "src/index.js",
      env: { NODE_ENV: "production", PORT: 3000 }
    }
  ]
}
