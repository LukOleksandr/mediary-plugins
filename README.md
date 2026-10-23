# Mediary plugins

Search plugins for [Mediary](https://github.com/MediaryDesktop): each finds
releases on one site and hands them to the node, which parses, ranks, streams
and downloads them as it does any other source's.

| Plugin | Site | Language | Reaches |
|---|---|---|---|
| [`aniliberty`](aniliberty/plugin.js) | AniLiberty (formerly AniLibria) | ru | `aniliberty.top` |

These plugins are not part of Mediary and Mediary does not host, provide or
recommend any media. A plugin only searches a site's public listing; what you
download through it, and whether you may, is between you and that site.

## Install

In Mediary: **Settings → Extensions → Catalog → Repositories**, add

```
https://raw.githubusercontent.com/LukOleksandr/mediary-plugins/main/repository.json
```

and install from the catalog. Mediary shows the sites a plugin will visit
before it installs anything.

## Changing a plugin

1. Edit `<id>/plugin.js` and raise its `version` in `build.py`.
2. `python build.py https://raw.githubusercontent.com/<owner>/<repo>/main` —
   rewrites each `manifest.json` with the code's SHA-256, and `repository.json`.
3. Commit both. Mediary refuses code whose sum does not match its manifest.

Check a plugin against the types before committing:

```
npx tsc --noEmit --strict --checkJs --allowJs --target es2022 --lib es2022 <id>/plugin.js plugin.d.ts
```

`plugin.d.ts` is in the node's repository, `docs/plugins/plugin.d.ts`.
