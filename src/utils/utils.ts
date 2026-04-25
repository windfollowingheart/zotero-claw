async function getPort(): Promise<number | null> {
  const { FileUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/FileUtils.sys.mjs",
  );
  const home = FileUtils.getDir("Home", []).path;
  const targetPath = PathUtils.join(
    home,
    ".zotero-claw",
    "workspace",
    "config.json",
  );
  console.log(targetPath);
  if (!(await IOUtils.exists(targetPath))) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: "Config file not found",
        type: "fail",
      })
      .show();
    return null;
  }
  const config = await IOUtils.readJSON(targetPath);
  console.log(config);
  if (!config.port) {
    new ztoolkit.ProgressWindow(addon.data.config.addonName)
      .createLine({
        text: "Port not found in config",
        type: "fail",
      })
      .show();
    return null;
  }
  return config.port;
}

export { getPort };
