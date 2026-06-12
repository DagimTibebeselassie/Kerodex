# Kerodex Versioning

Kerodex uses semantic versioning.

- Patch: bug fixes that do not add user-facing features, for example `v1.1.1`.
- Minor: new backwards-compatible features, for example `v1.2.0`.
- Major: breaking changes, large migrations, or incompatible API changes, for example `v2.0.0`.

Current app version: `v1.1.0`

When updating the version, change:

1. Root `package.json`
2. `apps/web-react/package.json`
3. `apps/web-react/src/version.ts`

Then add a short note to the README or release notes describing the change.
