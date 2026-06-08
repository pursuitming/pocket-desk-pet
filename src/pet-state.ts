import type { AnimationId } from "./types";

export type PetState = "idle" | "acting" | "dragging" | "sleeping";

export class PetStateMachine {
  private currentState: PetState = "idle";
  private activeAnimation: AnimationId = "idle";

  get state(): PetState {
    return this.currentState;
  }

  reset(): void {
    this.currentState = "idle";
    this.activeAnimation = "idle";
  }

  request(animationId: AnimationId): boolean {
    if (animationId === "drag") {
      this.currentState = "dragging";
      this.activeAnimation = animationId;
      return true;
    }

    if (animationId === "drop") {
      if (this.currentState !== "dragging") {
        return false;
      }

      this.currentState = "acting";
      this.activeAnimation = animationId;
      return true;
    }

    if (animationId === "idle") {
      this.currentState = "idle";
      this.activeAnimation = animationId;
      return true;
    }

    if (this.currentState === "dragging" || this.currentState === "acting") {
      return false;
    }

    if (this.currentState === "sleeping" && animationId !== "touch") {
      return false;
    }

    if (animationId === "sleep") {
      this.currentState = "sleeping";
      this.activeAnimation = animationId;
      return true;
    }

    this.currentState = "acting";
    this.activeAnimation = animationId;
    return true;
  }

  complete(animationId: AnimationId): void {
    if (this.activeAnimation !== animationId) {
      return;
    }

    if (this.currentState === "acting") {
      this.currentState = "idle";
      this.activeAnimation = "idle";
    }
  }
}
