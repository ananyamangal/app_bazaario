"use strict";

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Set org.gradle.workers.max in gradle.properties to reduce Gradle Worker Daemon
 * timeouts and system load during assembleRelease (e.g. safe-area-context compile).
 * Runs at prebuild so it survives "expo prebuild --clean".
 */
function withAndroidGradleWorkers(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const gradlePath = path.join(projectRoot, "gradle.properties");
      if (!fs.existsSync(gradlePath)) return cfg;
      let content = fs.readFileSync(gradlePath, "utf8");
      if (!content.includes("org.gradle.workers.max=")) {
        content += "\n# Reduce workers to avoid Worker Daemon timeout on heavy builds\norg.gradle.workers.max=2\n";
        fs.writeFileSync(gradlePath, content);
      }
      return cfg;
    },
  ]);
}

module.exports = withAndroidGradleWorkers;
