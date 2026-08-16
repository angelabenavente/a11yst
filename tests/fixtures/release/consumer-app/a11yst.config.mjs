const PORT = Number(process.env.PORT ?? 4178);

export default {
  outputDir: ".a11yst/results",
  sourceAnalysis: {
    enabled: true,
    ranking: true,
    recommendations: true,
  },
  reports: {
    html: true,
    markdown: true,
  },
  ci: {
    failOnNew: false,
    failOnRegression: false,
    failOnExpiredClassification: false,
  },
  projects: [
    {
      name: "consumer-app",
      rootDir: ".",
      platform: "web",
      framework: "html",
      baseUrl: `http://127.0.0.1:${PORT}`,
      devServer: {
        command: "node server.mjs",
        url: `http://127.0.0.1:${PORT}`,
        reuseExisting: true,
        startupTimeout: 30_000,
      },
      routes: [{ id: "home", name: "Home", path: "/" }],
      profiles: ["default"],
      viewports: [{ name: "desktop", width: 1280, height: 720 }],
    },
  ],
};
