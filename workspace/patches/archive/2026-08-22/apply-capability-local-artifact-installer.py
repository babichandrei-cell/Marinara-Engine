#!/usr/bin/env python3
from pathlib import Path

ROOT = Path.cwd()
REL = Path('packages/server/src/services/capability-packages/package-manager.service.ts')
p = ROOT / REL
s = p.read_text()

# Add local-imports directory constant.
anchor = 'const VERSIONS = join(ROOT, "versions");\n'
addition = anchor + 'const LOCAL_IMPORTS = join(ROOT, "local-imports");\n'
if 'const LOCAL_IMPORTS = join(ROOT, "local-imports");' not in s:
    if s.count(anchor) != 1:
        raise SystemExit(f'[FAIL] LOCAL_IMPORTS anchor count={s.count(anchor)}')
    s = s.replace(anchor, addition, 1)

start_marker = 'async function installCatalogPackage(entry: CapabilityCatalogPackage, activateDuringStartup = false) {'
end_marker = '\n\nexport const capabilityPackageManager = {'
start = s.find(start_marker)
end = s.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('[FAIL] installCatalogPackage block not found')

old_block = s[start:end]
for needle in [
    'const archive = await fetchBytes',
    'const zip = new AdmZip(archive);',
    'const installedManifest = capabilityPackageManifestSchema.parse',
    'const temporary = join(ROOT, `.install-${manifest.id}-${Date.now()}`);',
]:
    if needle not in old_block:
        raise SystemExit(f'[FAIL] expected install implementation fragment missing: {needle}')

new_block = r'''async function installPackageArchive(
  archive: Buffer,
  options: {
    expectedManifest?: CapabilityCatalogPackage["manifest"];
    expectedArtifactBytes?: number;
    expectedArtifactSha256?: string;
    activateDuringStartup?: boolean;
  } = {},
) {
  if (archive.byteLength > MAX_ARTIFACT_BYTES) throw new Error("Package artifact is too large");
  if (options.expectedArtifactBytes !== undefined && archive.byteLength !== options.expectedArtifactBytes) {
    throw new Error("Downloaded package size does not match the catalog");
  }
  if (options.expectedArtifactSha256) {
    const digest = createHash("sha256").update(archive).digest("hex");
    if (digest !== options.expectedArtifactSha256) throw new Error("Downloaded package checksum does not match the catalog");
  }

  const zip = new AdmZip(archive);
  const entries = validatePackageArchiveEntries(zip);
  const manifestEntry = entries.find((item) => item.entryName === "manifest.json");
  if (!manifestEntry || manifestEntry.header.size > MAX_MANIFEST_BYTES) {
    throw new Error("Package manifest is missing or too large");
  }

  const installedManifest = capabilityPackageManifestSchema.parse(JSON.parse(manifestEntry.getData().toString("utf8")));
  if (options.expectedManifest && JSON.stringify(installedManifest) !== JSON.stringify(options.expectedManifest)) {
    throw new Error("Artifact manifest does not match the catalog");
  }

  const manifest = installedManifest;
  const installIssue = getCapabilityPackageInstallIssue(manifest);
  if (installIssue) throw new Error(installIssue);
  const initiallyInstalled = (await readRegistry()).packages.find((item) => item.id === manifest.id);
  assertNotDowngrade(initiallyInstalled, manifest.version);
  const capabilityApiIssue = getCapabilityApiCompatibilityIssue(manifest);
  if (capabilityApiIssue) throw new Error(capabilityApiIssue);

  const syntheticEntry = {
    manifest,
    artifact: {
      url: "https://local.invalid/package.zip",
      sha256: createHash("sha256").update(archive).digest("hex"),
      bytes: archive.byteLength,
    },
  } as CapabilityCatalogPackage;
  if (!supportsEngineVersion(syntheticEntry, APP_VERSION)) {
    throw new Error(`Package requires Marinara Engine ${manifest.engine.min} to below ${manifest.engine.maxExclusive}`);
  }

  const declaredFiles = new Map(installedManifest.files.map((file) => [normalizeArchivePath(file.path), file]));
  if (declaredFiles.size !== installedManifest.files.length) throw new Error("Package manifest declares duplicate files");
  const caseFoldedPaths = new Set(installedManifest.files.map((file) => normalizeArchivePath(file.path).toLowerCase()));
  if (caseFoldedPaths.size !== installedManifest.files.length)
    throw new Error("Package manifest declares files that collide on case-insensitive filesystems");

  const payloadEntries = entries.filter((item) => item.entryName !== "manifest.json");
  if (payloadEntries.length !== declaredFiles.size) throw new Error("Package contains undeclared or missing files");

  const verifiedFiles = new Map<string, Buffer>();
  for (const item of payloadEntries) {
    const name = normalizeArchivePath(item.entryName);
    const declaration = declaredFiles.get(name);
    if (!declaration) throw new Error(`Package contains undeclared file ${name}`);
    const data = item.getData();
    if (data.byteLength !== declaration.bytes) throw new Error(`Package file size mismatch for ${name}`);
    if (createHash("sha256").update(data).digest("hex") !== declaration.sha256) {
      throw new Error(`Package file checksum mismatch for ${name}`);
    }
    verifiedFiles.set(name, data);
  }

  for (const entrypoint of Object.values(installedManifest.entrypoints)) {
    if (entrypoint && !declaredFiles.has(normalizeArchivePath(entrypoint))) {
      throw new Error(`Package entrypoint is not declared: ${entrypoint}`);
    }
  }

  const agentDetailIds = installedManifest.contributions?.agentDetail?.agentIds ?? [];
  if (agentDetailIds.length > 0 && !installedManifest.entrypoints.client) {
    throw new Error("Agent detail contributions require a client entrypoint");
  }
  if (agentDetailIds.length > 0 && !installedManifest.entrypoints.agents) {
    throw new Error("Agent detail contributions require agent definitions");
  }
  if (installedManifest.entrypoints.agents) {
    const agentsPath = normalizeArchivePath(installedManifest.entrypoints.agents);
    const agentsFile = verifiedFiles.get(agentsPath);
    if (!agentsFile) throw new Error("Package agent definitions are missing");
    const agentDefinitions = packagedAgentDefinitionsSchema.parse(JSON.parse(agentsFile.toString("utf8")));
    for (const agentId of agentDetailIds) {
      const detailIssue = getCapabilityAgentDetailDefinitionIssue(agentId, agentDefinitions);
      if (detailIssue) throw new Error(detailIssue);
    }
  }

  const temporary = join(ROOT, `.install-${manifest.id}-${Date.now()}`);
  const destination = join(VERSIONS, manifest.id, manifest.version);
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  try {
    await writeFile(join(temporary, "manifest.json"), manifestEntry.getData(), { mode: 0o600 });
    for (const [name, data] of verifiedFiles) {
      const output = inside(temporary, join(temporary, name));
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, data, { mode: 0o600 });
    }
    await mkdir(dirname(destination), { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await rename(temporary, destination);

    const registry = await readRegistry();
    const previous = registry.packages.find((item) => item.id === manifest.id);
    assertNotDowngrade(previous, manifest.version);
    const installed: InstalledCapabilityPackage = {
      id: manifest.id,
      version: manifest.version,
      manifest,
      installedAt: new Date().toISOString(),
      status: manifest.restartRequired && !options.activateDuringStartup ? "restart-required" : "active",
      error: null,
      readiness: manifest.entrypoints.server ? "pending" : "ready",
      readinessError: null,
      legacy: false,
      ...(previous && previous.version !== manifest.version ? { previousVersion: previous.version } : {}),
    };
    await writeRegistry([...registry.packages.filter((item) => item.id !== manifest.id), installed]);
    try {
      await clearDeclinedUpdate(manifest.id);
    } catch (error) {
      logger.warn(error, "Could not clear the deferred update marker for capability package %s", manifest.id);
    }
    return installed;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function installCatalogPackage(entry: CapabilityCatalogPackage, activateDuringStartup = false) {
  const { manifest, artifact } = entry;
  const installIssue = getCapabilityPackageInstallIssue(manifest);
  if (installIssue) throw new Error(installIssue);
  const initiallyInstalled = (await readRegistry()).packages.find((item) => item.id === manifest.id);
  assertNotDowngrade(initiallyInstalled, manifest.version);
  const capabilityApiIssue = getCapabilityApiCompatibilityIssue(manifest);
  if (capabilityApiIssue) throw new Error(capabilityApiIssue);
  if (!supportsEngineVersion(entry, APP_VERSION)) {
    throw new Error(`Package requires Marinara Engine ${manifest.engine.min} to below ${manifest.engine.maxExclusive}`);
  }
  const archive = await fetchBytes(artifact.url, Math.min(artifact.bytes + 1, MAX_ARTIFACT_BYTES));
  return installPackageArchive(archive, {
    expectedManifest: manifest,
    expectedArtifactBytes: artifact.bytes,
    expectedArtifactSha256: artifact.sha256,
    activateDuringStartup,
  });
}
'''

s = s[:start] + new_block + s[end:]

anchor = '  async uninstall(packageId: string) {\n'
method = r'''  /**
   * Trusted local-development install path. Not exposed over HTTP.
   * The artifact must live under DATA_DIR/capability-packages/local-imports.
   */
  async installLocalArtifact(filename: string) {
    const name = filename.trim();
    if (!name || name.includes("/") || name.includes("\\") || !name.toLowerCase().endsWith(".zip")) {
      throw new Error("Local capability artifact filename is invalid");
    }
    const artifactPath = inside(LOCAL_IMPORTS, join(LOCAL_IMPORTS, name));
    const archive = await readFile(artifactPath);
    if (archive.byteLength > MAX_ARTIFACT_BYTES) throw new Error("Package artifact is too large");
    return installPackageArchive(archive);
  },

'''
if 'async installLocalArtifact(filename: string)' not in s:
    if s.count(anchor) != 1:
        raise SystemExit(f'[FAIL] uninstall anchor count={s.count(anchor)}')
    s = s.replace(anchor, method + anchor, 1)

p.write_text(s)
print('[OK] local Capability Package artifact installer applied.')
print('[NEXT] git diff --check && docker build --target builder -t marinara-engine-check .')
