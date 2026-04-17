# Contributing Guidelines

## Table of Contents
- [Contributing Guidelines](#contributing-guidelines)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Branch Strategy](#branch-strategy)
    - [Branch Rules](#branch-rules)
  - [Workflow](#workflow)
  - [Core Principles](#core-principles)
  - [Commit Format](#commit-format)
  - [Commit Rules](#commit-rules)
  - [Pull Requests](#pull-requests)
  - [Merge Flow](#merge-flow)
    - [Standard flow](#standard-flow)
    - [Release flow](#release-flow)
    - [Hotfix flow](#hotfix-flow)
  - [Push Guidelines](#push-guidelines)
  - [Merge Conflicts \& Rebasing](#merge-conflicts--rebasing)
  - [Review Process](#review-process)
  - [Updating PRs](#updating-prs)
  - [Contributors](#contributors)

---

## Overview

All changes must go through pull requests. Direct commits to protected branches are not allowed.

Keep commits small, independent, and reviewable.

---

## Branch Strategy

| Branch       | Purpose                   | Rules                     |
| ------------ | ------------------------- | ------------------------- |
| `main`       | Production-ready code     | Protected, no direct push |
| `dev`        | Integration branch        | All features merge here   |
| `release/v*` | Release candidates        | Stabilization only        |
| `feature/*`  | New features              | Branch from `dev`         |
| `fix/*`      | Bug fixes                 | Branch from `dev`         |
| `hotfix/*`   | Critical production fixes | Branch from `main`        |

### Branch Rules

* All feature work branches from `dev`
* `dev` is the main integration branch
* `main` is production only
* `release/*` used only for final stabilization
* No direct commits to `main`, `dev`, or `release/*`

---

## Workflow

```bash id="g4nqk2"
git checkout dev
git pull origin dev

git checkout -b feature-name

# make changes
git add file1 file2
git commit -m "subsystem: short description"

git push origin feature-name
```

Open a pull request into `dev`.

---

## Core Principles

* One logical change per commit
* Each commit must build and pass tests
* Do not mix unrelated changes
* PRs must be reviewable commit-by-commit

---

## Commit Format

```id="q8m2ld"
<subsystem>: <short summary>

What changed and why (optional).
```

---

## Commit Rules

* No large or mixed commits
* Avoid trivial or repeated commits
* Each commit must stand on its own
* Use clear, scoped messages

---

## Pull Requests

* Target branch: `dev` (unless hotfix/release)
* Keep commits clean and sequential
* CI must pass before review
* Include a short summary of changes

Example:

```id="c9v1ta"
Summary of changes

Commits:
1. Add feature X
2. Add tests for feature X
```

---

## Merge Flow

### Standard flow

```id="r2k9xq"
feature/* → dev → release/* → main
```

### Release flow

* `dev` → `release/vX.Y.Z`
* Final testing on release branch
* `release/*` → `main`
* Back-merge `release/*` → `dev`

### Hotfix flow

* `hotfix/*` from `main`
* Merge into `main`
* Back-merge into `dev`

---

## Push Guidelines

* Never force push to `main`, `dev`, or `release/*`
* Feature branches may use `--force-with-lease` if required
* Push small, frequent commits
* Rebase before pushing updates

---

## Merge Conflicts & Rebasing

Keep branch updated with `dev`:

```bash id="m1z8vp"
git pull --rebase origin dev
```

If conflicts occur:

* Fix conflicted files
* Ensure build/tests pass

```bash id="t7q3nx"
git add .
git rebase --continue
```

Cancel rebase:

```bash id="u5d0kp"
git rebase --abort
```

Rules:

* Always prefer rebase over merge
* No merge commits in feature branches
* Rebase before PR and after conflicts

---

## Review Process

* All PRs require review
* Address feedback with new commits
* Do not force-push after review starts unless requested

---

## Updating PRs

* Add new commits for fixes
* Keep history intact during review
* Make changes incremental and traceable

---

## Contributors

**Nemith Kaluarachchi** — System Integration & Project Management

* Coordination across teams
* Sprint planning
* Integration testing
* Documentation

**Sangeeth Kariyapperuma** — Fullstack Integration

* API integration
* WebSocket handling
* State management
* Data transformation

**Suntharalingam Kamsan** — Frontend (UI & Visualization)

* Dashboard development
* Real-time charts
* UI/UX

**Chalani Karunanayaka** — Backend (APIs & Data Layer)

* REST APIs
* Database design
* Data aggregation

**Teshan Kannangara** — Backend (Real-Time Streaming & Messaging)

* Kafka consumers
* WebSocket streaming
* Core service architecture
