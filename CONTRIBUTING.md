# Contributing

Kerodex is currently source-available, not open source. Public visibility does not grant permission to reuse the code outside this repository.

## Contribution Rules

- Open an issue before large changes.
- Keep changes focused and easy to review.
- Do not commit secrets, API keys, tokens, private certificates, or real customer data.
- Run the smoke test before submitting changes:

```powershell
npm.cmd test
```

## Pull Request Expectations

Include:

- What changed.
- Why it changed.
- Screenshots for UI work.
- Test results.
- Any known risks or follow-ups.

## Long-Term Engineering Standards

As Kerodex grows, changes should preserve:

- Fast search and browsing.
- Mobile-first usability.
- Clear service boundaries.
- Security by default.
- Auditability for trust and safety workflows.
- Low-cost infrastructure until scale requires more.
