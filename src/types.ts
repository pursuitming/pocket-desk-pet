export type AnimationId =
  | "idle"
  | "walkLeft"
  | "walkRight"
  | "touch"
  | "drag"
  | "jump"
  | "drop"
  | "sleep"
  | "happy"
  | "special";

export interface PetFrameCell {
  column: number;
  row: number;
}

export interface PetAnimation {
  row?: number;
  frames?: number;
  cells?: PetFrameCell[];
  fps: number;
  loop: boolean;
}

export interface PetHitbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PetManifest {
  id: string;
  name: string;
  author: string;
  version: string;
  sprite: string;
  preview: string;
  frameWidth: number;
  frameHeight: number;
  scale: number;
  hitbox?: PetHitbox;
  animations: Record<AnimationId, PetAnimation>;
}

export type PetLines = Partial<Record<AnimationId, string[]>>;

export interface PetPackage {
  manifest: PetManifest;
  lines: PetLines;
}
