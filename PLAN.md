# Pipelens — VS Code Extension Plan

## Project Overview

A VS Code extension that authenticates with Git providers (GitHub, GitLab), lets you select a repository from a dropdown, and shows a live, modern pipeline/CI view inside the editor.

---

## Architecture

```
pipelens/
├── src/
│   ├── extension.ts               # Activation entry point
│   ├── auth/
│   │   ├── AuthManager.ts         # Token storage via VS Code SecretStorage
│   │   ├── GitHubAuth.ts          # GitHub OAuth Device Flow
│   │   └── GitLabAuth.ts          # GitLab OAuth Device Flow / PAT
│   ├── providers/
│   │   ├── IProvider.ts           # Common interface for all providers
│   │   ├── github/
│   │   │   ├── GitHubProvider.ts  # Repo + pipeline fetching
│   │   │   └── GitHubApi.ts       # REST/GraphQL wrappers
│   │   └── gitlab/
│   │       ├── GitLabProvider.ts
│   │       └── GitLabApi.ts
│   ├── views/
│   │   ├── SidebarProvider.ts     # Activity bar: repo picker + status tree
│   │   ├── PipelinePanel.ts       # WebView panel for live pipeline view
│   │   └── StatusBarItem.ts       # Quick status in the bottom bar
│   └── webview/                   # Bundled separately (Vite)
│       ├── index.html
│       ├── App.tsx                # React component tree
│       ├── components/
│       │   ├── PipelineGraph.tsx  # Stage/job DAG visualization
│       │   ├── JobCard.tsx        # Individual job with status + log
│       │   └── LogViewer.tsx      # Streaming log output
│       └── styles/
│           └── pipelens.css
├── package.json                   # Extension manifest + contributes
├── tsconfig.json
└── vite.config.ts                 # Bundles the webview separately
```

---

## Tech Stack

| Layer              | Choice                               | Reason                                              |
| ------------------ | ------------------------------------ | --------------------------------------------------- |
| Extension host     | TypeScript + VS Code API             | Standard; full IntelliSense + type safety           |
| WebView UI         | React + Vite                         | Fast HMR during dev, tree-shakeable bundle          |
| Styling            | CSS Variables / VS Code theme tokens | Adapts to light/dark/high-contrast themes           |
| GitHub auth        | `vscode.authentication` (built-in)   | No OAuth app needed; VS Code handles the flow       |
| GitLab auth        | Personal Access Token                | Simple, secure via SecretStorage; no OAuth app      |
| Azure DevOps auth  | Personal Access Token                | Same rationale; PAT with Build+Code Read scopes     |
| Token storage      | `vscode.SecretStorage`               | OS keychain backed, never plaintext                 |
| API calls          | Native `fetch` (Node 18+)            | Zero dependencies; all providers use REST           |

---

## Implementation Phases

### Phase 1 — Scaffolding & Authentication

**Goal:** Extension activates, users can sign in to GitHub and/or GitLab.

- Scaffold with `yo code` (TypeScript, no WebView yet)
- Register commands: `pipelens.signInGitHub`, `pipelens.signInGitLab`, `pipelens.signOut`
- `AuthManager`: wraps `vscode.SecretStorage` — `storeToken(provider, token)`, `getToken(provider)`, `clearToken(provider)`
- **GitHub Device Flow:**
  1. POST `/login/device/code` → get `device_code` + `user_code`
  2. Open browser to `github.com/login/device` and show `user_code` in a VS Code notification
  3. Poll `POST /login/oauth/access_token` until approved
  4. Store access token
- **GitLab Device Flow** (same pattern) or prompt for a Personal Access Token as a simpler fallback
- On activation, silently restore tokens from SecretStorage

---

### Phase 2 — Repository Picker (Sidebar)

**Goal:** Activity bar panel with a searchable list of repos across all signed-in providers.

- Register a `TreeDataProvider` under a custom Activity Bar icon
- Tree structure:
  ```
  ▾ GitHub (maheshr)
      my-repo              ← click to open pipeline view
      another-repo
  ▾ GitLab (maheshr)
      infra-project
  ```
- Fetch repos: GitHub `GET /user/repos` (paginated, sorted by `pushed_at`), GitLab `GET /projects?membership=true`
- Cache repo list in memory; refresh button in the panel title
- Clicking a repo fires `pipelens.openPipelineView(repo)` and persists the selection to `workspaceState`
- Quick Pick command (`Ctrl+Shift+P → Select Repository`) as keyboard-friendly alternative

---

### Phase 3 — Pipeline Data Layer

**Goal:** Fetch the most recent pipeline and its jobs/stages for any selected repo.

**Common interface `IProvider`:**

```ts
interface IProvider {
  listRepos(): Promise<Repo[]>
  getLatestPipeline(repo: Repo): Promise<Pipeline>
  getPipelineJobs(pipeline: Pipeline): Promise<Job[]>
  getJobLog(job: Job): Promise<string>
}
```

**GitHub Actions mapping:**

- Latest run: `GET /repos/{owner}/{repo}/actions/runs?per_page=1`
- Jobs: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`
- Log: `GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs`

**GitLab CI mapping:**

- Latest pipeline: `GET /projects/{id}/pipelines?per_page=1`
- Jobs: `GET /projects/{id}/pipelines/{pid}/jobs`
- Log: `GET /projects/{id}/jobs/{job_id}/trace`

**Models:**

```ts
type PipelineStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped'

interface Pipeline { id, name, status: PipelineStatus, startedAt, finishedAt, branch, commitSha, url }
interface Job       { id, name, stage, status: PipelineStatus, startedAt, duration, webUrl }
```

---

### Phase 4 — Live Pipeline WebView

**Goal:** A modern, animated pipeline view rendered in a VS Code WebView panel.

**PipelinePanel.ts** (extension host side):

- Creates `vscode.WebviewPanel` with `retainContextWhenHidden: true`
- Passes initial pipeline data via `panel.webview.postMessage({ type: 'init', data })`
- Starts a polling loop (5s for active pipelines, 30s when complete)
- On each poll, sends `{ type: 'update', data }` — only diffs matter
- Listens for messages from WebView (e.g., `{ type: 'requestLog', jobId }`)

**WebView UI (React):**

```
┌─────────────────────────────────────────────────────────────┐
│  ◉ main  •  feat/login  8a3f2d1  •  2 min ago              │
│  ● build (45s)  →  ● test (1m 12s)  →  ◌ deploy (running)  │
├─────────────────────────────────────────────────────────────┤
│  STAGE: deploy                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ ✓ deploy-staging │  │ ◌ deploy-prod    │                │
│  │   42s            │  │   running…       │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  [Job Log — deploy-prod] ▼                                  │
│  $ docker build ...                                         │
│  Step 1/8 : FROM node:20-alpine                             │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

- Stage pipeline rendered as a horizontal flow (flexbox, not canvas)
- Each job card shows: icon + color per status, name, duration
- Running jobs show a CSS spinner animation
- Click a job card → fetch and stream its log below
- Uses VS Code CSS variables (`--vscode-editor-background`, etc.) so it looks native in any theme

---

### Phase 5 — Status Bar & Notifications

**Goal:** Ambient awareness without opening the panel.

- Status bar item (left side): `$(sync~spin) pipeline: running` → `$(check) pipeline: passed` → `$(x) pipeline: failed`
- Clicking it opens/focuses the PipelinePanel
- VS Code notification on terminal state change:
  - `Pipeline passed on main` (info)
  - `Pipeline failed on main — 2 jobs failed` (error, with "View Details" button)
- Notifications are opt-out via a config setting

---

## Configuration (`package.json` contributes)

```jsonc
"configuration": {
  "pipelens.pollIntervalSeconds": 10,           // default: 10
  "pipelens.notifyOnComplete": true,
  "pipelens.showStatusBarItem": true,
  "pipelens.gitlabBaseUrl": "https://gitlab.com" // override for self-hosted GitLab instances
}
```

---

## Key VS Code API Usage

| Need                   | API                                        |
| ---------------------- | ------------------------------------------ |
| Secure token storage   | `vscode.SecretStorage`                   |
| Sidebar panel          | `vscode.window.registerTreeDataProvider` |
| Pipeline WebView       | `vscode.window.createWebviewPanel`       |
| Status bar             | `vscode.window.createStatusBarItem`      |
| Open browser for OAuth | `vscode.env.openExternal`                |
| Show user code prompt  | `vscode.window.showInformationMessage`   |
| Settings               | `vscode.workspace.getConfiguration`      |
| Persist last repo      | `context.workspaceState.update`          |

---

## Development Milestones

| Milestone      | Deliverable                                                      |
| -------------- | ---------------------------------------------------------------- |
| M1 (Day 1-2)   | Scaffolded extension, GitHub Device Flow auth working end-to-end |
| M2 (Day 3-4)   | Sidebar repo picker, GitLab auth, repo list from both providers  |
| M3 (Day 5-7)   | Pipeline data layer, polling, status bar                         |
| M4 (Day 8-11)  | WebView pipeline graph, job cards, status animations             |
| M5 (Day 12-14) | Job log streaming, notifications, VS Code theme integration      |
| M6 (Day 15)    | Packaging (`vsce package`), README, marketplace prep           |

---

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Bitbucket support | Add later | Keep scope tight; add as a fourth provider post-launch |
| GitLab self-hosted | Yes, from day one | `pipelens.gitlabBaseUrl` config defaults to `https://gitlab.com`; any self-hosted instance just overrides it |
| Azure DevOps support | **Built** | PAT auth + `pipelens.azureDevOpsOrgUrl`; ADO projects → Repo, builds → Pipeline, timeline Job records → Job |
| Multiple repos open simultaneously | Single panel that switches | WebView panels are heavy; a single focused panel with a repo switcher at the top avoids tab clutter and matches VS Code's own terminal/browser-preview pattern |
| Log streaming | Poll endpoint repeatedly | Simpler, provider-agnostic; avoids dealing with GitHub's short-lived streaming URLs and GitLab's chunked trace endpoint edge cases |
