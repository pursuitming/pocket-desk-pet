import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_ANIMATIONS = [
  "idle",
  "walkLeft",
  "walkRight",
  "touch",
  "drag",
  "jump",
  "drop",
  "sleep",
  "happy",
  "special",
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const petsRoot = path.join(root, "public", "pets");
const petIndexPath = path.join(petsRoot, "pets.json");

const errors = [];
const warnings = [];

async function main() {
  const petIds = await readJson(petIndexPath, "pet index");

  if (!Array.isArray(petIds)) {
    errors.push("public/pets/pets.json must be an array of pet ids.");
    return finish();
  }

  if (!petIds.length) {
    errors.push("public/pets/pets.json must enable at least one pet.");
    return finish();
  }

  const seen = new Set();
  for (const id of petIds) {
    if (typeof id !== "string" || !id.trim()) {
      errors.push(`Invalid pet id in pets.json: ${JSON.stringify(id)}`);
      continue;
    }

    if (seen.has(id)) {
      errors.push(`Duplicate pet id in pets.json: ${id}`);
      continue;
    }

    seen.add(id);
    await validatePet(id);
  }

  finish();
}

async function validatePet(id) {
  const petDir = path.join(petsRoot, id);
  const manifestPath = path.join(petDir, "pet.json");
  const linesPath = path.join(petDir, "lines.json");
  const manifest = await readJson(manifestPath, `${id} manifest`);

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    errors.push(`${id}: pet.json must be an object.`);
    return;
  }

  requireString(manifest, "id", id);
  requireString(manifest, "name", id);
  requireString(manifest, "author", id);
  requireString(manifest, "version", id);
  requireString(manifest, "sprite", id);
  requireString(manifest, "preview", id);
  requirePositiveNumber(manifest, "frameWidth", id);
  requirePositiveNumber(manifest, "frameHeight", id);
  requirePositiveNumber(manifest, "scale", id);

  if (manifest.id !== id) {
    errors.push(`${id}: manifest id must match directory/index id.`);
  }

  if (typeof manifest.sprite === "string") {
    await requireFile(path.join(petDir, manifest.sprite), `${id}: sprite file is missing: ${manifest.sprite}`);
  }

  await warnMissingFile(linesPath, `${id}: lines.json is missing; the pet will run without speech lines.`);

  validateHitbox(manifest, id);
  validateAnimations(manifest, id);
}

function validateHitbox(manifest, id) {
  if (manifest.hitbox === undefined) {
    return;
  }

  if (!manifest.hitbox || typeof manifest.hitbox !== "object" || Array.isArray(manifest.hitbox)) {
    errors.push(`${id}: hitbox must be an object when provided.`);
    return;
  }

  for (const key of ["x", "y", "width", "height"]) {
    if (!Number.isFinite(manifest.hitbox[key])) {
      errors.push(`${id}: hitbox.${key} must be a finite number.`);
    }
  }

  if (Number.isFinite(manifest.hitbox.width) && manifest.hitbox.width <= 0) {
    errors.push(`${id}: hitbox.width must be greater than 0.`);
  }

  if (Number.isFinite(manifest.hitbox.height) && manifest.hitbox.height <= 0) {
    errors.push(`${id}: hitbox.height must be greater than 0.`);
  }
}

function validateAnimations(manifest, id) {
  const animations = manifest.animations;
  if (!animations || typeof animations !== "object" || Array.isArray(animations)) {
    errors.push(`${id}: animations must be an object.`);
    return;
  }

  for (const animationId of REQUIRED_ANIMATIONS) {
    const animation = animations[animationId];
    if (!animation || typeof animation !== "object" || Array.isArray(animation)) {
      errors.push(`${id}: missing animation ${animationId}.`);
      continue;
    }

    if (!Number.isFinite(animation.fps) || animation.fps <= 0) {
      errors.push(`${id}: animation ${animationId}.fps must be greater than 0.`);
    }

    if (typeof animation.loop !== "boolean") {
      errors.push(`${id}: animation ${animationId}.loop must be a boolean.`);
    }

    if (animation.cells !== undefined) {
      validateCells(animation.cells, id, animationId);
      continue;
    }

    if (!Number.isInteger(animation.row) || animation.row < 0) {
      errors.push(`${id}: animation ${animationId}.row must be a non-negative integer when cells are not provided.`);
    }

    if (!Number.isInteger(animation.frames) || animation.frames <= 0) {
      errors.push(`${id}: animation ${animationId}.frames must be a positive integer when cells are not provided.`);
    }
  }
}

function validateCells(cells, id, animationId) {
  if (!Array.isArray(cells) || !cells.length) {
    errors.push(`${id}: animation ${animationId}.cells must be a non-empty array when provided.`);
    return;
  }

  cells.forEach((cell, index) => {
    if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
      errors.push(`${id}: animation ${animationId}.cells[${index}] must be an object.`);
      return;
    }

    if (!Number.isInteger(cell.column) || cell.column < 0) {
      errors.push(`${id}: animation ${animationId}.cells[${index}].column must be a non-negative integer.`);
    }

    if (!Number.isInteger(cell.row) || cell.row < 0) {
      errors.push(`${id}: animation ${animationId}.cells[${index}].row must be a non-negative integer.`);
    }
  });
}

function requireString(object, key, id) {
  if (typeof object[key] !== "string" || !object[key].trim()) {
    errors.push(`${id}: ${key} must be a non-empty string.`);
  }
}

function requirePositiveNumber(object, key, id) {
  if (!Number.isFinite(object[key]) || object[key] <= 0) {
    errors.push(`${id}: ${key} must be a number greater than 0.`);
  }
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    errors.push(`Failed to read ${label} at ${relative(filePath)}: ${error.message}`);
    return undefined;
  }
}

async function requireFile(filePath, message) {
  try {
    await access(filePath);
  } catch {
    errors.push(message);
  }
}

async function warnMissingFile(filePath, message) {
  try {
    await access(filePath);
  } catch {
    warnings.push(message);
  }
}

function finish() {
  for (const warning of warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (errors.length) {
    for (const error of errors) {
      console.error(`Error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Pet package validation passed.");
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

await main();
