# Mediary plugins

Plugins for [Mediary](https://github.com/MediaryDesktop). A torrent plugin
finds releases on one site and hands them to the node, which parses, ranks,
streams and downloads them as it does any other source's; a manga plugin lists
a site's series, chapters and pages, and the node fetches the pages for its
reader and saves chapters as CBZ.

| Plugin | Site | Language | Reaches |
|---|---|---|---|
| [`aniliberty`](aniliberty/plugin.js) | AniLiberty (formerly AniLibria) | ru | `aniliberty.top` |
| [`nyaa`](nyaa/plugin.js) | Nyaa | multi | `nyaa.si` |
| [`mangalib`](mangalib/plugin.js) | MangaLib (manga) | ru | `api2.mangalib.me`, `mangalib.me`, `*.imglib.info`, `*.cdnlibs.org` |
| [`slashlib`](slashlib/plugin.js) | SlashLib (manga; some titles 18+) | ru | `api2.mangalib.me`, `slashlib.me`, `*.hentaicdn.org` |
| [`mangahub`](mangahub/plugin.js) | MangaHub (manga) | ru | `mangahub.ru`, `*.statichub.org` |
| [`zazaza`](zazaza/plugin.js) | ZazaZa (manga; images without the site's signature) | ru | `a.zazaza.me`, `*.one-way.work` |

These plugins are not part of Mediary and Mediary does not host, provide or
recommend any media. A plugin only reads a site's public listing; what you
download or read through it, and whether you may, is between you and that site.

## Install

In Mediary: **Settings → Extensions → Catalog → Repositories**, add

```
https://raw.githubusercontent.com/LukOleksandr/mediary-plugins/main/repository.json
```

and install from the catalog. Mediary shows the sites a plugin will visit
before it installs anything.

## Changing a plugin

1. Edit `<id>/plugin.js` and raise its `version` in `build.py`. `slashlib` is
   written from `mangalib/plugin.js` by the build; change that one, and raise
   both versions.
2. `python build.py https://raw.githubusercontent.com/<owner>/<repo>/main` —
   rewrites each `manifest.json` with the code's SHA-256, and `repository.json`.
3. Commit both. Mediary refuses code whose sum does not match its manifest.

Check a plugin against the types before committing:

```
npx tsc --noEmit --strict --checkJs --allowJs --target es2022 --lib es2022 <id>/plugin.js plugin.d.ts
```

`plugin.d.ts` is in the node's repository, `docs/plugins/plugin.d.ts`.
