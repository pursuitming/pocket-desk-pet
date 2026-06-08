# GPT Image Asset Generation

This project keeps generated pet assets under `public/pets/<pet-id>/`.

Required environment:

- `OPENAI_API_KEY` set in the shell, project `.env`, or user profile `~/.env`
- Installed Codex skill at `~/.codex/skills/gpt-image`
- `uv` or Python 3.11+ for running the skill launcher
- Optional: ImageMagick later for extracting `preview.webp` from a finished spritesheet

This project script calls the installed skill launcher first:

```text
~/.codex/skills/gpt-image/scripts/generate.py
```

It does not require `gpt-image` to already be on `PATH`.

Recommended one-session key setup:

```powershell
$env:OPENAI_API_KEY="sk-your-key-here"
```

Recommended project-local setup:

```powershell
Set-Content -Path .env -Value 'OPENAI_API_KEY=sk-your-key-here' -Encoding UTF8
```

Do not commit `.env`.

Generate all three spritesheets:

```powershell
.\scripts\generate-pet-assets.ps1 -Pet all -Quality high
```

Generate one pet:

```powershell
.\scripts\generate-pet-assets.ps1 -Pet moyu-cat -Quality high
```

Spritesheet target:

- File: `spritesheet.webp`
- Generated canvas: `1024x1536`
- Runtime canvas after chroma-key cleanup: `1020x1530`
- Grid: 6 columns x 9 rows
- Frame: `170x170`
- Generated background: flat chroma-key green `#00FF00`, removed locally after generation
- Rows: `idle`, `walkLeft`, `walkRight`, `touch`, `drag`, `jump/drop`, `sleep`, `happy`, `special`

The current prompts are designed as high quality first-pass cartoon spritesheets. They should still be reviewed in Aseprite or a similar tool before treating them as final game-ready animation assets.
