# Self-hosted CI runner — setup for Simon

Status: GitHub-hosted runners are currently unusable on this account
(billing lock — see `docs/RELEASE.md` "CI AVAILABILITY NOTE").
Self-hosted runners are **free** and need no billing. This document is the
complete, copy-pasteable procedure to turn your own machine into the CI
runner. Every step below runs **on your machine**, not in this repo.

> What this changes: only WHERE CI jobs run. The checks themselves
> (lint + typecheck + unit tests + build + DB gate, including tag
> validation) are identical. Nothing is skipped. `release.yml` still
> refuses every deployment run (fail-closed) — it just executes that
> refusal on your runner instead of hanging on a billing-locked queue.

## Prerequisites (your machine)

- A Linux x64 machine that stays on during CI runs (or macOS — see the
  macOS note in step 5). The `db` CI job needs **Docker** (it starts a
  `postgres:18` service container); the `app` job needs **Node 26** only
  via `actions/setup-node` (no local install required).
- Admin/sudo access (only needed if you install the runner as a service).
- A GitHub account with admin access to this repo (to generate the token).

## Step 1 — open the runner registration page

1. Go to the repo: `https://github.com/Xdashio/wellups-auto-tyres`
2. Click **Settings → Actions → Runners** (left sidebar).
3. Click **"New self-hosted runner"**.
4. Select your machine's OS/architecture (e.g. **Linux / x64**).

GitHub now shows download + configure commands. The exact version number
in the download URL changes over time — **copy the download commands from
that page**, do not reuse an old version blindly.

## Step 2 — download and extract (Linux x64 example)

Run these **on your machine**, in a directory you will keep (e.g.
`~/actions-runner`). Replace the version with the one shown on the page:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-x64-2.329.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz
echo "<SHA_FROM_THE_PAGE>  actions-runner-linux-x64-2.329.0.tar.gz" | shasum -a 256 -c
tar xzf ./actions-runner-linux-x64-2.329.0.tar.gz
```

(The page shows the current version + expected SHA — paste those in.)

## Step 3 — register the runner (needs the token from YOUR screen)

The `./config.sh` command requires two values that **only exist on the
registration page from Step 1** — they cannot be generated from this repo:

- `--url https://github.com/Xdashio/wellups-auto-tyres`
- `--token <THE_TOKEN_SHOWN_ON_THE_PAGE>` (single-use, expires in ~1 hour)

```bash
cd ~/actions-runner
./config.sh --url https://github.com/Xdashio/wellups-auto-tyres --token <PASTE_TOKEN_HERE>
```

Accept the defaults when prompted (runner name, work folder). When asked
for labels, press Enter for the default (`self-hosted,Linux,X64`) — the
workflow targets the `self-hosted` label.

## Step 4 — route CI to your runner (repo variable)

Still in the GitHub UI (repo **Settings → Secrets and variables →
Actions → Variables** tab → **"New repository variable"**):

- Name: `CI_RUNS_ON`
- Value: `["self-hosted"]`

Both CI jobs read this variable and will queue on your runner from the
next push/PR/tag onward. **To revert** to GitHub-hosted runners later,
delete the variable (the workflows default to `["ubuntu-latest"]`).

## Step 5 — start the runner

Foreground (good for the first test run — you can watch jobs execute):

```bash
cd ~/actions-runner
./run.sh
```

Background service (so it survives logout — Linux with systemd):

```bash
cd ~/actions-runner
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status   # should report active
```

Useful service commands: `sudo ./svc.sh stop`, `sudo ./svc.sh start`,
`sudo ./svc.sh uninstall` (to remove it entirely).

macOS note: there is no `svc.sh` systemd path on macOS. Either keep
`./run.sh` running in a terminal/`tmux` session, or schedule it at login
(e.g. a LaunchAgent plist calling `/path/to/actions-runner/run.sh`).

Docker note: the `db` CI job starts a `postgres:18` container, so Docker
(or Docker Desktop on macOS) must be running on the runner machine.
Without Docker, the `app` job still passes but the `db` job fails — that
is a machine prerequisite, not a repo defect.

## Step 6 — verify

1. On the runner machine, `./run.sh` (or the service) shows `Listening for Jobs`.
2. Back in GitHub: repo → **Actions** tab → pick any recent run →
   jobs should show `Runs on: self-hosted` and go green.
3. Push an empty commit or open a test PR and confirm both `app` and
   `db` jobs execute on your runner.
4. Tag validation still applies: any `v*` tag push runs the full CI
   suite on your runner (validates, never deploys).

## Manual step the maintainer cannot do for you

Generating the `--token` in Step 3 requires clicking through YOUR GitHub
UI (Settings → Actions → Runners → New self-hosted runner). No one else
can register this runner. Everything else in this file is ready to paste.
