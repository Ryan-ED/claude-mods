# claude-mods

My Claude Code mods, as a plugin marketplace.

| Mod | What it does |
| --- | --- |
| `session-bar` | A band above the prompt: folder, git branch, model, context-window %, session cost and plan usage limits |

## Install

At a Claude Code prompt (terminal):

```
/plugin install session-bar --marketplace Ryan-ED/claude-mods
```

Answer `y` to add the marketplace, then pick the user scope. The repo is private, so the machine's git needs
access to it (e.g. `gh auth login`).

Update later with `claude plugin update session-bar`.

## Developing

Edit a mod's folder, then run `/reload-plugins` in a session that installed it from this folder
(`claude plugin marketplace add ~/.claude/mods`). Check a mod with `claude plugin validate <folder>` and
`claude plugin test <folder>`.
