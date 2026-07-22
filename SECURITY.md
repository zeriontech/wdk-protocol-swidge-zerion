# Security Policy

## Reporting a Vulnerability

If you believe you have found a security vulnerability in this module, please report it privately to **security@zerion.io**. Do not open a public issue for security reports.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce
- Any relevant logs, transactions, or proof-of-concept code

We will acknowledge your report and keep you informed of the remediation progress.

## Scope

This module never handles seed phrases or private keys directly: signing and broadcasting are performed by the WDK wallet account passed to the protocol. The module's security-sensitive surface is limited to:

- Building Zerion API requests (the API key is sent via HTTP Basic auth over HTTPS)
- Mapping API responses into transactions submitted to the wallet account

## Supported Versions

Only the latest published version receives security fixes.
