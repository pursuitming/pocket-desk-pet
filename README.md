# DeskPet

> 一个基于 **Tauri 2 + TypeScript + Vite + PixiJS** 的轻量 Windows 本地桌宠应用。

DeskPet 目前专注于把桌宠的核心体验做稳定：透明置顶窗口、本地宠物包、spritesheet 动画播放、点击互动、窗口拖拽、缩放设置和本地偏好保存。项目暂不依赖独立后端，也不优先追求 AI 对话、云端社区或复杂游戏系统。

> English: A lightweight local-first animated desktop pet app for Windows, powered by Tauri and PixiJS.

---

## 功能特性

- **透明桌面窗口**：无边框、置顶、跳过任务栏，适合作为桌面宠物常驻显示。
- **PixiJS 动画渲染**：使用 spritesheet 播放宠物动作动画。
- **本地宠物包**：宠物资源放在 `public/pets/<pet-id>/`，通过 `pet.json` 和 `lines.json` 描述。
- **基础互动**：支持点击、拖拽、右键菜单、跳跃、睡觉、开心、专属动作等。
- **粗略 hitbox 命中**：支持在 `pet.json` 中配置 `hitbox`，减少透明区域误触。
- **用户设置保存**：保存当前宠物、缩放比例和窗口位置。
- **本地优先**：无需后端服务，适合本地自用和二次开发。

---

## 技术栈

| 类型 | 技术 |
|---|---|
| 桌面框架 | [Tauri 2](https://tauri.app/) |
| 前端语言 | TypeScript |
| 构建工具 | Vite |
| 渲染引擎 | PixiJS |
| 桌面运行环境 | Windows + WebView2 |
| 原生层 | Rust / Cargo |
| 包管理 | npm |

---

## 项目结构

```text
DeskPet/
├─ index.html
├─ package.json
├─ src/
│  ├─ main.ts          # 应用入口，负责初始化、交互绑定、设置保存
│  ├─ pet-player.ts    # PixiJS 宠物渲染与动画播放
│  ├─ pet-loader.ts    # 宠物包加载逻辑
│  ├─ types.ts         # 宠物 manifest、动画、台词等类型定义
│  └─ styles.css       # 透明窗口、气泡、控制菜单样式
├─ public/
│  └─ pets/
│     ├─ pets.json     # 当前启用的宠物 ID 列表
│     └─ <pet-id>/
│        ├─ pet.json
│        ├─ lines.json
│        ├─ spritesheet.png
│        └─ preview.png
├─ src-tauri/
│  ├─ tauri.conf.json
│  ├─ capabilities/
│  └─ src/main.rs
└─ scripts/
   ├─ run-desktop.ps1
   └─ build-desktop.ps1
```

---

## 环境要求

本项目当前主要面向 **Windows**。

### 必需环境

- [Node.js](https://nodejs.org/) 18+，推荐使用 LTS 版本
- npm
- [Rust](https://www.rust-lang.org/tools/install) 与 Cargo
- Microsoft Edge WebView2 Runtime
- Visual Studio Build Tools 2022
  - 安装时勾选 **Desktop development with C++** 工作负载
  - 需要 Windows SDK 和 MSVC 工具链

### Windows PowerShell 注意事项

如果你的 PowerShell 策略阻止运行 `npm.ps1`，可以使用：

```powershell
npm.cmd install
npm.cmd run build
```

或者在 Git Bash / 其他终端中直接使用：

```bash
npm install
npm run build
```

---

## 本地开发

### 1. 克隆项目

```bash
git clone https://github.com/pursuitming/pocket-desk-pet.git
cd pocket-desk-pet
```

### 2. 安装依赖

```bash
npm install
```

PowerShell 中如遇执行策略问题：

```powershell
npm.cmd install
```

### 3. 运行前端开发预览

```bash
npm run dev
```

默认会启动 Vite 开发服务器：

```text
http://127.0.0.1:1420
```

这个模式主要用于调试前端渲染和资源加载，不完全等同于真实桌面窗口行为。

### 4. 运行桌面应用

```bash
npm run desktop
```

该命令会通过 `scripts/run-desktop.ps1` 启动 Tauri 桌面应用。

如果你想直接使用 Tauri CLI，也可以运行：

```bash
npm run tauri dev
```

---

## 构建与发布

### 校验宠物包

```bash
npm run validate:pets
```

这个命令会检查 `public/pets/pets.json` 中启用的宠物包，确认 `pet.json`、spritesheet、动画配置等基础运行资源可用。

### 构建前端产物

```bash
npm run build
```

这个命令会执行：

```text
npm run validate:pets && tsc && vite build
```

用于校验宠物包、检查 TypeScript 类型并生成 `dist/` 前端产物。

### 构建桌面安装包

```bash
npm run desktop:build
```

或者直接使用：

```bash
npm run tauri build
```

当前 Tauri 配置中的打包目标为：

```json
"targets": ["nsis"]
```

构建完成后，安装包一般会输出到：

```text
src-tauri/target/release/bundle/
```

> 注意：桌面打包需要 Rust、MSVC Build Tools、Windows SDK、WebView2 等环境完整可用。

---

## 调试 hitbox

如果需要调整宠物点击范围，可以开启 hitbox 调试框。

方式一：在浏览器预览地址中添加参数：

```text
http://127.0.0.1:1420/?debugHitbox=1
```

方式二：运行应用后按快捷键切换：

```text
Ctrl + Shift + H
```

开启后会用红色半透明矩形显示当前宠物的 hitbox。该开关会写入 `localStorage`，再次按快捷键可以关闭。

---

## 宠物包规范

每个宠物包推荐放在：

```text
public/pets/<pet-id>/
├─ pet.json
├─ lines.json
├─ spritesheet.png
└─ preview.png
```

### `pets.json`

`public/pets/pets.json` 用于声明当前启用的宠物：

```json
[
  "moyu-cat",
  "offwork-hero",
  "goldpotato"
]
```

如果你本地有不适合公开提交的测试宠物，可以创建本地覆盖文件：

```text
public/pets/pets.local.json
```

应用启动时会优先读取 `pets.local.json`，读取不到时再回退到公开的 `pets.json`。这个本地文件已加入 `.gitignore`，适合放仅供本机使用的宠物列表。

### `pet.json` 示例

```json
{
  "id": "sample-pet",
  "name": "示例宠物",
  "author": "DeskPet",
  "version": "0.1.0",
  "sprite": "spritesheet.png",
  "preview": "preview.png",
  "frameWidth": 192,
  "frameHeight": 208,
  "scale": 0.95,
  "hitbox": {
    "x": 32,
    "y": 16,
    "width": 128,
    "height": 176
  },
  "animations": {
    "idle": { "row": 0, "frames": 6, "fps": 6, "loop": true },
    "walkLeft": { "row": 1, "frames": 8, "fps": 6, "loop": true },
    "walkRight": { "row": 2, "frames": 8, "fps": 6, "loop": true },
    "touch": { "row": 3, "frames": 4, "fps": 4, "loop": false },
    "jump": { "row": 4, "frames": 5, "fps": 5, "loop": false },
    "drag": { "row": 5, "frames": 6, "fps": 6, "loop": true },
    "drop": { "row": 6, "frames": 8, "fps": 6, "loop": false },
    "sleep": { "row": 5, "frames": 6, "fps": 3, "loop": true },
    "happy": { "row": 3, "frames": 4, "fps": 4, "loop": false },
    "special": { "row": 7, "frames": 6, "fps": 6, "loop": false }
  }
}
```

### `lines.json` 示例

```json
{
  "idle": ["我在这里。", "今天也要一起加油。"],
  "touch": ["被摸到了。", "轻一点呀。"],
  "drag": ["要带我去哪里？"],
  "jump": ["起飞！"],
  "drop": ["落地完成。"],
  "sleep": ["进入休息模式。"],
  "happy": ["状态不错！"],
  "special": ["专属动作启动。"]
}
```

---

## 推荐 spritesheet 规格

当前推荐使用 GIF 动作素材拆帧后合成 spritesheet。

```text
frameWidth: 192
frameHeight: 208
spritesheet: 1536 x 1664
layout: 8 列 x 8 行
scale: 0.95
```

动作行约定：

| Row | 动作 | AnimationId |
|---:|---|---|
| 0 | 待机 | `idle` |
| 1 | 向左跑 | `walkLeft` |
| 2 | 向右跑 | `walkRight` |
| 3 | 挥手 / 点击反馈 | `touch` / `happy` |
| 4 | 跳跃 | `jump` |
| 5 | 等待 / 拖拽 / 低功耗 | `drag` / `sleep` |
| 6 | 失败 / 落地 | `drop` |
| 7 | 专属动作 | `special` |

---

## 当前状态

DeskPet 当前已经实现一个可运行 MVP：

- 透明置顶桌宠窗口
- PixiJS spritesheet 动画播放
- 本地宠物包加载
- 宠物切换
- 台词气泡
- 控制菜单
- 基础动作按钮
- 缩放设置
- 窗口位置保存
- 粗略 hitbox 命中判断

后续计划：

- 更稳定的透明区域点击穿透方案
- 随机待机行为
- 连续点击互动
- 轻量状态机
- 宠物生成脚本
- 宠物包校验脚本
- 系统托盘菜单
- 设置窗口
- 性能模式

---

## 授权与素材说明

代码可以按你选择的开源协议发布，例如 MIT 或 Apache-2.0。

宠物素材需要单独注意授权：

- 自制或原创素材可以随项目发布。
- 第三方 IP 风格素材建议仅用于本地测试或学习，不建议随公开仓库或发行包分发。
- 用户导入自定义宠物资源时，应自行确认素材授权。

如果你计划正式开源，建议在仓库中添加 `LICENSE` 文件，并在 README 或资源目录中明确素材授权范围。

---

## 贡献

欢迎基于本项目进行二次开发，例如：

- 新增原创宠物包
- 优化桌宠交互
- 改进 hitbox 与点击穿透
- 增加随机行为和状态机
- 完善打包发布流程

提交改动前建议先运行：

```bash
npm run build
```

如果涉及桌面窗口行为，请同时运行：

```bash
npm run desktop
```

并手动验证点击、拖拽、右键菜单、宠物切换、缩放和退出恢复。