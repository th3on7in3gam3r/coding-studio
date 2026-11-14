import { PHP, loadPHPRuntime, type PHPLoaderModule } from "@php-wasm/universal";
self.onmessage = async (
  e: MessageEvent<{
    files: Record<string, string>;
    assets: Record<string, string>;
    entry: string;
  }>,
) => {
  try {
    const loader = await import(/* webpackIgnore: true */ "./php-loader.js");
    const php = new PHP(
      await loadPHPRuntime(loader as PHPLoaderModule, {
        locateFile: () => new URL("./php.wasm", self.location.href).href,
      }),
    );
    php.mkdir("/project");
    for (const [path, text] of Object.entries(e.data.files)) {
      php.mkdirTree("/project/" + path.split("/").slice(0, -1).join("/"));
      php.writeFile("/project/" + path, text);
    }
    for (const [path, data] of Object.entries(e.data.assets)) {
      php.mkdirTree("/project/" + path.split("/").slice(0, -1).join("/"));
      php.writeFile(
        "/project/" + path,
        Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
      );
    }
    const response = await php.run({
      scriptPath: "/project/" + e.data.entry,
      relativeUri: "/" + e.data.entry,
    });
    if (response.exitCode !== 0)
      throw new Error(response.errors || `PHP exit ${response.exitCode}`);
    self.postMessage({ html: response.text, errors: response.errors });
    php.exit();
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
};
