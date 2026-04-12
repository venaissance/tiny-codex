# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in TinyCodex, please report it responsibly.

**Do NOT open a public issue.** Instead, email the maintainer directly:

- Email: mizeyuyu@gmail.com
- Subject: `[SECURITY] TinyCodex - <brief description>`

You should receive a response within 48 hours. We will work with you to understand and address the issue before any public disclosure.

## Scope

This policy applies to:
- The TinyCodex Electron application
- All tools that execute on the user's machine (bash, file I/O)
- IPC communication between main and renderer processes

## Best Practices for Users

- Never share your `.env` file or API keys
- Review agent-generated bash commands before approving execution
- Use Worktree mode for untrusted operations (isolates changes to a git branch)
