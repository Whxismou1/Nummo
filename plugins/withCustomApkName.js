const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to customize Android output APK file name to Nummo-v<version>.apk
 */
const withCustomApkName = (config) => {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language === "groovy") {
      const customApkScript = `
// Custom APK naming for Nummo
android.applicationVariants.all { variant ->
    variant.outputs.all {
        outputFileName = "Nummo-v\${variant.versionName}.apk"
    }
}
`;
      if (!modConfig.modResults.contents.includes("Custom APK naming for Nummo")) {
        modConfig.modResults.contents += customApkScript;
      }
    }
    return modConfig;
  });
};

module.exports = withCustomApkName;
