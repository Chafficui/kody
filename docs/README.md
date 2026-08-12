# Kody documentation

This folder holds contributor- and operator-facing documentation for the
public, self-hostable Kody repository. It is the canonical source for
architectural and security details. Anyone running Kody on their own
infrastructure should find what they need here.

## Contents

- [`architecture.md`](architecture.md) — runtime architecture, the package
  layout, the three-layer guardrails, and the database schema.
- [`security.md`](security.md) — the full security model: three-layer
  guardrails, prompt injection protection, Unicode normalization,
  authentication, secret handling, rate limiting, and data deletion.

## Conventions

- Each file is a flat Markdown document.
- Code blocks are plain TypeScript / bash / SQL — no JSX components.
- URLs inside documentation are relative where possible
  (`./security.md`) so the docs work in any GitHub viewer.
