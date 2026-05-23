# Security Policy

Kerodex is an early prototype, but the product direction includes identity verification, vehicle ownership checks, payments, messaging, and fraud detection. Security issues should be treated seriously from the start.

## Reporting

Do not open public issues for vulnerabilities.

For now, report security concerns directly to the repository owner. A dedicated security contact should be added before any public launch.

## Current Scope

In scope:

- Authentication/session bugs.
- API exposure.
- Data leakage.
- Unsafe file handling.
- Dependency or CI/CD risks.
- Trust and safety bypasses.

Out of scope for the prototype:

- Social engineering.
- Denial-of-service against local development.
- Issues requiring real production credentials, since none should exist in this repo.

## Production Security Roadmap

- Real OAuth provider setup.
- MFA support.
- Rate limiting.
- Audit logs.
- Upload scanning.
- EXIF stripping.
- Plate blur/image privacy.
- Secrets management.
- WAF and DDoS controls.
- Least-privilege IAM.
- Security scanning in CI.
