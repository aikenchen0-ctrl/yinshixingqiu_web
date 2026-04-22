# 无头串行执行脚本说明

已为这个仓库补好 Windows 可用的串行无头执行脚本：

- [scripts/run-codex-serial-headless.ps1](D:\CodeDevelopment\xueyinMiniapp\scripts\run-codex-serial-headless.ps1)

## 设计目标

- 按 `docs/serial-prompts` 里的 10 份提示词顺序执行
- 每份提示词至少执行 2 遍
- 当前默认最多执行 2 遍，不再默认跑到第 3、4 遍
- 上一份提示词的最后摘要，会自动作为下一份提示词的输入
- 每一轮的输入、输出、JSON 事件流、标准输出、标准错误都落盘

## 与你给的“无头模式”要求怎么对应

### 1. 无头执行

脚本使用的是本机已安装的 `codex exec` 非交互模式。
真实执行时会优先解析并使用可直接启动的 Codex 命令入口，避免 Windows 上裸调用 `codex` 时命中不可执行别名。

### 2. `codex --yolo`

你要求使用 `codex --yolo`。  
脚本会先探测当前本机 `codex --help` 是否支持 `--yolo`：

- 如果支持：使用 `codex --yolo exec`
- 如果不支持：自动回退到等价的全权限模式  
  `codex exec --dangerously-bypass-approvals-and-sandbox`

这样做的原因是，你当前机器上的 Codex CLI 帮助输出里没有显式列出 `--yolo`，但有官方提供的等价全权限参数。

### 3. 完全权限

脚本默认使用无沙箱全权限执行模式。

## 输出目录

执行后会生成：

- `.codex-headless/runs/<提示词名>/pass-N/`
- `.codex-headless/summaries/`
- `.codex-headless/tmp/`

每一轮至少会包含：

- `input.md`
- `result.md`
- `stdout.log`

真实调用 Codex 时还会额外生成：

- `events.jsonl`
- `stderr.log`

如果使用 `-DryRun`，不会调用 Codex，也不会生成 `events.jsonl` 和 `stderr.log`。

## 推荐执行方式

在项目根目录打开 PowerShell，执行：

```powershell
pwsh -NoProfile -File .\scripts\run-codex-serial-headless.ps1
```

这样可以避免本机 PowerShell profile 里的额外初始化脚本干扰无头执行。

## 常用参数

### 只演练，不真正调用 Codex

```powershell
pwsh -NoProfile -File .\scripts\run-codex-serial-headless.ps1 -DryRun
```

`-DryRun` 只生成输入、占位结果和摘要，不依赖本机 Codex CLI 是否可用。

### 最少 2 轮，最多 6 轮

```powershell
pwsh -NoProfile -File .\scripts\run-codex-serial-headless.ps1 -MinPasses 2 -MaxPasses 6
```

### 指定模型

```powershell
pwsh -NoProfile -File .\scripts\run-codex-serial-headless.ps1 -Model gpt-5
```

### 打开联网搜索

```powershell
pwsh -NoProfile -File .\scripts\run-codex-serial-headless.ps1 -UseSearch
```

## 质量门槛

脚本要求每轮提示词的最终输出末尾包含：

```text
FINAL_STATUS: COMPLETE | PARTIAL | BLOCKED
QUALITY_SCORE: 1-5
NEXT_ACTIONS:
- ...
CHANGED_FILES:
- ...
```

脚本逻辑是：

- 固定先跑 2 遍
- 如果你手动把 `MaxPasses` 调高，状态已 `COMPLETE` 且质量分 `>= 4` 时会提前停止
- 如果 `MinPasses < 1`、`MaxPasses < 1`，或 `MinPasses > MaxPasses`，脚本会直接报错并停止

## 为什么我没有直接采用你发的第三方 fork

我看了你发的两个无头方案：

- `joneshong-skills/codex-cli-headless`
- `barnii77/codex-headless`

第二个仓库确实更偏向“静默 JSON + session 复用”的 headless fork，比较适合自定义前端或外部编排器。  
但你这台机器已经装了官方 `codex` CLI，而且已经支持稳定的 `exec` 非交互模式，所以我这里优先用“你本机现成可跑”的方式重写了脚本，兼容性更高，也不用额外安装 fork 版 CLI。

## 如果你后面想切换到 fork 版

可以改这个脚本里的 `Get-CodexBaseCommand` 和 `Invoke-CodexPass` 两部分，把命令替换成你下载或构建出来的 headless CLI。
