import {
  AnimatedSprite,
  Application,
  Assets,
  BaseTexture,
  Container,
  Graphics,
  Rectangle,
  SCALE_MODES,
  Text,
  Texture,
} from "pixi.js";
import { resolvePetAsset } from "./pet-loader";
import type { AnimationId, PetAnimation, PetFrameCell, PetHitbox, PetManifest } from "./types";

type AnimationTextures = Partial<Record<AnimationId, Texture[]>>;

const FALLBACK_COLORS: Record<string, number> = {
  "moyu-cat": 0xdce2e6,
  "offwork-hero": 0x3f7bd8,
  "lightwing-adept": 0x7fb8ff,
};

export class PetPlayer {
  private current?: Container;
  private sprite?: AnimatedSprite;
  private manifest?: PetManifest;
  private userScale = 1;
  private textures: AnimationTextures = {};
  private loadedSpriteUrl?: string;

  constructor(private readonly app: Application<HTMLCanvasElement>) {
    BaseTexture.defaultOptions.scaleMode = SCALE_MODES.LINEAR;
  }

  async load(manifest: PetManifest): Promise<void> {
    await this.dispose();
    this.manifest = manifest;

    try {
      await this.loadSpritesheet(manifest);
      this.play("idle");
    } catch (error) {
      console.warn(error);
      this.showFallback(manifest);
    }

    this.layout();
  }

  play(animationId: AnimationId): void {
    if (!this.manifest) {
      return;
    }

    if (!this.sprite) {
      this.showFallback(this.manifest, animationId);
      return;
    }

    const animation = this.manifest.animations[animationId];
    const textures = this.textures[animationId] ?? this.textures.idle;

    if (!animation || !textures?.length) {
      return;
    }

    this.sprite.textures = textures;
    this.sprite.loop = animation.loop;
    this.sprite.animationSpeed = animation.fps / 60;
    this.sprite.onComplete = animation.loop ? undefined : () => this.play("idle");
    this.sprite.gotoAndPlay(0);
  }

  setUserScale(scale: number): void {
    if (!Number.isFinite(scale)) {
      return;
    }

    this.userScale = Math.min(Math.max(scale, 0.5), 2);
    this.layout();
  }

  containsClientPoint(clientX: number, clientY: number): boolean {
    if (!this.current || !this.manifest) {
      return false;
    }

    const viewBounds = this.app.view.getBoundingClientRect();
    if (!viewBounds.width || !viewBounds.height) {
      return false;
    }

    const screenX = ((clientX - viewBounds.left) / viewBounds.width) * this.app.screen.width;
    const screenY = ((clientY - viewBounds.top) / viewBounds.height) * this.app.screen.height;
    const scale = this.manifest.scale * this.userScale;
    const localX = (screenX - this.current.x) / scale + this.manifest.frameWidth / 2;
    const localY = (screenY - this.current.y) / scale + this.manifest.frameHeight / 2;
    const hitbox = this.resolveHitbox(this.manifest);

    return (
      localX >= hitbox.x &&
      localX <= hitbox.x + hitbox.width &&
      localY >= hitbox.y &&
      localY <= hitbox.y + hitbox.height
    );
  }

  layout(): void {
    if (!this.current || !this.manifest) {
      return;
    }

    this.current.scale.set(this.manifest.scale * this.userScale);
    this.current.x = Math.round(this.app.screen.width / 2);
    this.current.y = Math.round(this.app.screen.height / 2 - 10);
  }

  private resolveHitbox(manifest: PetManifest): PetHitbox {
    if (manifest.hitbox) {
      return manifest.hitbox;
    }

    return {
      x: Math.round(manifest.frameWidth * 0.166),
      y: Math.round(manifest.frameHeight * 0.077),
      width: Math.round(manifest.frameWidth * 0.667),
      height: Math.round(manifest.frameHeight * 0.846),
    };
  }

  private async loadSpritesheet(manifest: PetManifest): Promise<void> {
    const spriteUrl = resolvePetAsset(manifest, manifest.sprite);
    const baseTexture = await Assets.load<Texture>(spriteUrl);
    this.loadedSpriteUrl = spriteUrl;

    this.textures = Object.fromEntries(
      Object.entries(manifest.animations).map(([id, animation]) => [
        id,
        this.createTextures(baseTexture, manifest, animation),
      ]),
    ) as AnimationTextures;

    const idleTextures = this.textures.idle;
    if (!idleTextures?.length) {
      throw new Error(`${manifest.id} has no idle animation textures`);
    }

    this.sprite = new AnimatedSprite(idleTextures);
    this.sprite.anchor.set(0.5);
    this.sprite.roundPixels = true;
    this.current = this.sprite;
    this.app.stage.addChild(this.sprite);
  }

  private createTextures(
    baseTexture: Texture,
    manifest: PetManifest,
    animation: PetAnimation,
  ): Texture[] {
    return this.resolveCells(animation).map((cell) => {
      const frame = new Rectangle(
        cell.column * manifest.frameWidth,
        cell.row * manifest.frameHeight,
        manifest.frameWidth,
        manifest.frameHeight,
      );

      return new Texture(baseTexture.baseTexture, frame);
    });
  }

  private resolveCells(animation: PetAnimation): PetFrameCell[] {
    if (animation.cells?.length) {
      return animation.cells;
    }

    const row = animation.row ?? 0;
    const frames = animation.frames ?? 1;

    return Array.from({ length: frames }, (_, column) => ({ column, row }));
  }

  private showFallback(manifest: PetManifest, state: AnimationId = "idle"): void {
    this.current?.destroy({ children: true });
    this.sprite = undefined;

    const root = new Container();
    const color = FALLBACK_COLORS[manifest.id] ?? 0xffffff;
    const body = new Graphics();

    body.beginFill(color, 0.96);
    body.drawRoundedRect(-52, -46, 104, 92, 20);
    body.endFill();

    body.beginFill(0x223047, 1);
    body.drawCircle(-22, -12, 5);
    body.drawCircle(22, -12, 5);
    body.endFill();

    body.lineStyle(4, 0x223047, 0.9);
    body.moveTo(-12, 12);
    body.quadraticCurveTo(0, 20, 12, 12);

    if (manifest.id === "moyu-cat") {
      body.beginFill(color, 0.96);
      body.drawPolygon([-44, -40, -28, -72, -12, -42]);
      body.drawPolygon([44, -40, 28, -72, 12, -42]);
      body.endFill();
      body.beginFill(0xda4b4b, 1);
      body.drawRect(-34, 34, 68, 8);
      body.endFill();
      body.beginFill(0xf5c542, 1);
      body.drawCircle(0, 46, 8);
      body.endFill();
    }

    if (manifest.id === "offwork-hero") {
      body.beginFill(0xd94848, 0.95);
      body.drawPolygon([-56, -34, -88, 40, -38, 30]);
      body.drawPolygon([56, -34, 88, 40, 38, 30]);
      body.endFill();
      body.beginFill(0xf2c94c, 1);
      body.drawCircle(0, -62, 24);
      body.endFill();
    }

    if (manifest.id === "lightwing-adept") {
      body.beginFill(0x8be7ff, 0.35);
      body.drawEllipse(-70, -10, 34, 74);
      body.drawEllipse(70, -10, 34, 74);
      body.endFill();
      body.lineStyle(3, 0xf2c94c, 0.95);
      body.drawRoundedRect(-40, 20, 80, 28, 10);
    }

    const label = new Text(`${manifest.name}\n${state}`, {
      align: "center",
      fill: 0x1f2937,
      fontFamily: "Microsoft YaHei, sans-serif",
      fontSize: 12,
      fontWeight: "600",
      lineHeight: 18,
    });
    label.anchor.set(0.5);
    label.y = 74;

    root.addChild(body, label);
    this.current = root;
    this.app.stage.addChild(root);
  }

  private async dispose(): Promise<void> {
    this.current?.destroy({ children: true, texture: false, baseTexture: false });
    this.current = undefined;
    this.sprite = undefined;
    this.textures = {};

    if (this.loadedSpriteUrl) {
      await Assets.unload(this.loadedSpriteUrl).catch(() => undefined);
      this.loadedSpriteUrl = undefined;
    }
  }
}
