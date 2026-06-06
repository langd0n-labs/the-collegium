import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import YAML from "yaml";
import { z } from "zod";

const fellowSchema = z.object({
  name: z.string().min(1),
  persona_file: z.string().min(1),
  activation_keywords: z.array(z.string().min(1)).default([]),
});

const forgeSchema = z.object({
  name: z.string().min(1),
  skill_files: z.array(z.string().min(1)).default([]),
});

const manifestSchema = z.object({
  channel_id: z.string().min(1),
  fellows: z.array(fellowSchema).default([]),
  forges: z.array(forgeSchema).default([]),
});

export type CollegiumManifest = z.infer<typeof manifestSchema>;
export type FellowManifest = z.infer<typeof fellowSchema>;
export type ForgeManifest = z.infer<typeof forgeSchema>;

export interface LoadedFellow extends FellowManifest {
  persona: string;
}

export interface LoadedForge extends ForgeManifest {
  skills: string[];
}

export async function loadManifest(path: string): Promise<CollegiumManifest> {
  const manifestPath = resolve(path);
  const raw = await readFile(manifestPath, "utf8");
  const expanded = raw.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name: string) => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable referenced by manifest: ${name}`);
    }
    return value;
  });
  return manifestSchema.parse(YAML.parse(expanded));
}

export async function loadFellowFromManifest(
  manifestPath: string,
  fellowName: string,
): Promise<{ manifest: CollegiumManifest; fellow: LoadedFellow }> {
  const manifest = await loadManifest(manifestPath);
  const fellow = manifest.fellows.find((candidate) => candidate.name === fellowName);
  if (!fellow) {
    throw new Error(`Fellow "${fellowName}" is not declared in ${manifestPath}`);
  }

  const personaPath = resolve(dirname(resolve(manifestPath)), "..", fellow.persona_file);
  const persona = await readFile(personaPath, "utf8");
  return { manifest, fellow: { ...fellow, persona } };
}

export async function loadForgeFromManifest(
  manifestPath: string,
  forgeName: string,
): Promise<{ manifest: CollegiumManifest; forge: LoadedForge }> {
  const manifest = await loadManifest(manifestPath);
  const forge = manifest.forges.find((candidate) => candidate.name === forgeName);
  if (!forge) {
    throw new Error(`Forge "${forgeName}" is not declared in ${manifestPath}`);
  }

  const basePath = resolve(dirname(resolve(manifestPath)), "..");
  const skills = await Promise.all(
    forge.skill_files.map((skillFile) => readFile(resolve(basePath, skillFile), "utf8")),
  );
  return { manifest, forge: { ...forge, skills } };
}
