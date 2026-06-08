import type { PetLines, PetManifest, PetPackage } from "./types";

const PET_INDEX_URL = "/pets/pets.json";
const LOCAL_PET_INDEX_URL = "/pets/pets.local.json";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function loadPetIds(): Promise<string[]> {
  return fetchJson<string[]>(LOCAL_PET_INDEX_URL).catch(() => fetchJson<string[]>(PET_INDEX_URL));
}

export async function loadPetPackage(id: string): Promise<PetPackage> {
  const basePath = `/pets/${id}`;
  const [manifest, lines] = await Promise.all([
    fetchJson<PetManifest>(`${basePath}/pet.json`),
    fetchJson<PetLines>(`${basePath}/lines.json`).catch(() => ({})),
  ]);

  return { manifest, lines };
}

export function resolvePetAsset(manifest: PetManifest, fileName: string): string {
  return `/pets/${manifest.id}/${fileName}`;
}
