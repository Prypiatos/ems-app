# Contributing Guidelines

## Overview

All contributions must be submitted via pull requests. Direct commits to protected branches are not allowed.

Commits must be small, independent, and easy to review.

---

## Workflow

```bash
git checkout -b feature-name
# make changes
git add changed-file1 changed-file2
git commit
git push origin feature-name
````

Open a pull request from your branch.

---

## Core Principles

* One logical change per commit
* Commits must build and pass tests
* Do not mix unrelated changes
* PRs should be reviewable commit-by-commit

---

## Commit Format

```
<subsystem>: <short summary>

What changed and why.
```

---

## Commit Rules

* No large or mixed commits
* Avoid trivial or repeated commits
* Each commit should stand on its own

---

## Pull Requests

* Use a feature branch
* Keep a clean commit sequence
* Pass CI checks (if applicable)
* Include a short summary of changes

Example:

```
Summary of changes

Commits:
1. Add feature
2. Add tests
```

---

## Merge Conflicts & Rebasing

Keep your branch up to date:

```bash
git pull --rebase origin main
```

If conflicts occur:

* Resolve them in the affected files
* Verify the code builds and tests pass

Then continue:

```bash
git add .
git rebase --continue
```

To cancel:

```bash
git rebase --abort
```

### Notes

* Always prefer `git pull --rebase`
* Avoid merge commits in feature branches
* Rebase before opening a PR and when conflicts arise

---

## Review Process

* All PRs require review
* Address feedback with new commits
* Do not force-push unless requested

---

## Updating PRs

* Add commits for fixes
* Keep history intact
* Use clear commit messages

---

## Contributors

**Nemith Kaluarachchi** — System Integration & Project Management

* Coordination across teams (E1, E2, E4)
* Sprint planning
* Integration testing
* Documentation.

**Sangeeth Kariyapperuma** — Fullstack Integration

* API integration
* WebSocket client handling
* State management
* Data transformation.

**Suntharalingam Kamsan** — Frontend (UI & Visualization)

* Dashboard development
* Real-time charts
* UI/UX

**Chalani Karunanayaka** — Backend (APIs & Data Layer)

* REST APIs
* Database design
* Data aggregation
* Query design.

**Teshan Kannangara** — Backend (Real-Time Streaming & Messaging)

* Kafka consumers
* WebSocket streaming
* Core service architecture.