# Pentad Bureau — staging deployment

This document describes the custom, working deployment maintained in the `staging` branch of this fork.

## Current baseline

| Item | Value |
| --- | --- |
| Upstream Marinara Engine | `v2.4.4` |
| Upstream release commit | `1a299369ac7025028c3ce1b80cc59f47b7b0691b` |
| Fork deployment commit | `6187d2c809c473323fd5353a16081cfc52b803ed` |
| Deployment method | Docker Compose, locally built image |
| Application data | Persistent Docker volume `marinara-data` |
| Default port | `7860` |

The Docker Compose configuration builds `marinara-engine-local` from this source tree. This is intentional: the two patches below are source changes and therefore cannot use the upstream pre-built image.

## Applied patches

Both patches are already committed to `staging` and are also preserved in `/patches` for review, backup, and future rebases.

### Empty Roleplay Send continuation

- Patch: [`marinara-empty-send-continue-v8.patch`](../../patches/marinara-empty-send-continue-v8.patch)
- Applied by commit: `bfd0e822a`
- Behaviour: when the Roleplay input is empty after an assistant message, the client sends a request-local `Continue the story.` user turn. It reaches the model but is neither stored nor displayed as a user message.

### Illustrator after current-turn trackers

- Patch: [`marinara-illustrator-after-trackers-v2.4.4.patch`](../../patches/marinara-illustrator-after-trackers-v2.4.4.patch)
- Applied by commit: `6187d2c80`
- Behaviour: World State, Custom Tracker, and Character Tracker execute before Illustrator. Their successful results are injected into Illustrator as authoritative state for the current turn, while unrelated post-processing agents remain concurrent.

## Deliberately excluded

The previous `2.4.3` fork included Character Lore, capability API, identity-canonicalization, and A/B experiment changes. They are not part of this `v2.4.4` deployment.

The pre-upgrade state remains available in the GitHub branch `backup/pre-v2.4.4-staging-2026-08-27`. The pre-upgrade Docker image was also retained on the server as `marinara-engine-local:pre-v2.4.4-20260827`.

## Reapplying during a future upgrade

Use a clean checkout of the target upstream version. First validate, then apply each patch:

```bash
git apply --check patches/marinara-empty-send-continue-v8.patch
git apply --check patches/marinara-illustrator-after-trackers-v2.4.4.patch

git apply patches/marinara-empty-send-continue-v8.patch
git apply patches/marinara-illustrator-after-trackers-v2.4.4.patch
```

Resolve and test any failed hunks manually; these patch files target Marinara Engine `v2.4.4`.
