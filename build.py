"""Writes every plugin's manifest.json and the repository.json from the code
as it is now. Run it after changing a plugin.js: the manifest pins the code's
SHA-256, and Mediary refuses code that does not match.

    python build.py https://raw.githubusercontent.com/<owner>/<repo>/main
"""

import hashlib
import json
import pathlib
import sys

PLUGINS = {
    'aniliberty': {
        'name': 'AniLiberty',
        'version': '1.0.1',
        'author': 'Mediary community',
        'description': 'Russian dubs of anime from AniLiberty (aniliberty.top), formerly AniLibria: whole-season torrents through the site\'s public API.',
        'lang': 'ru',
        'homepage': 'https://aniliberty.top',
        'icon': 'https://cdn.anilibria.top/static/apple-touch-icon.png',
        # Magnets carry everything; no .torrent is fetched from anywhere else.
        'network': ['aniliberty.top'],
    },
    'mangalib': {
        'type': 'manga-provider',
        'name': 'MangaLib',
        'version': '1.0.0',
        'author': 'Mediary community',
        'description': 'Manga in Russian from MangaLib (mangalib.me), through the API its own site uses; every translation team of a chapter is a copy of its own.',
        'lang': 'ru',
        'homepage': 'https://mangalib.me',
        'icon': 'https://mangalib.me/static/images/logo/ml/icon-180.png',
        # The API, the site as the images' referrer, and the image servers it names.
        'network': ['api2.mangalib.me', 'mangalib.me', '*.imglib.info', '*.cdnlibs.org'],
        'config': [
            {
                'name': 'server',
                'label': 'Image server',
                'type': 'select',
                'options': ['main', 'compress'],
                'default': 'main',
            },
        ],
    },
    'slashlib': {
        'type': 'manga-provider',
        'name': 'SlashLib',
        'version': '1.0.0',
        'author': 'Mediary community',
        'description': "Manga in Russian from SlashLib (slashlib.me), MangaLib's sister site for BL titles, through the API both use. Some titles are 18+.",
        'lang': 'ru',
        'homepage': 'https://slashlib.me',
        'icon': 'https://mangalib.me/static/images/logo/sl/icon-180.png',
        # The API it shares with MangaLib, the site as the images' referrer, its image servers.
        'network': ['api2.mangalib.me', 'slashlib.me', '*.hentaicdn.org'],
        'config': [
            {
                'name': 'server',
                'label': 'Image server',
                'type': 'select',
                'options': ['main', 'compress'],
                'default': 'main',
            },
        ],
    },
    'mangahub': {
        'type': 'manga-provider',
        'name': 'MangaHub',
        'version': '1.0.0',
        'author': 'Mediary community',
        'description': 'Manga in Russian from MangaHub (mangahub.ru), read from its pages.',
        'lang': 'ru',
        'homepage': 'https://mangahub.ru',
        'icon': 'https://p1.statichub.org/icons/apple-touch-icon.png',
        # The site, and the image hosts its scans are on.
        'network': ['mangahub.ru', '*.statichub.org'],
    },
    'zazaza': {
        'type': 'manga-provider',
        'name': 'ZazaZa',
        'version': '1.0.0',
        'author': 'Mediary community',
        'description': "Manga in Russian from ZazaZa (a.zazaza.me), of ReadManga's Grouple network, read from its pages. The site signs its images' addresses and its image server refuses them outside a browser; the plugin drops the signature, which works around the site's protection and may stop working.",
        'lang': 'ru',
        'homepage': 'https://a.zazaza.me',
        'icon': 'https://resrm.one-way.work/static/apple-touch-icon-8e453b7539d40db129bdd248bc56aaca.png',
        # The site, and the network's image servers.
        'network': ['a.zazaza.me', '*.one-way.work'],
    },
    'nyaa': {
        'name': 'Nyaa',
        'version': '1.0.1',
        'author': 'Mediary community',
        'description': 'Anime releases from Nyaa (nyaa.si), read from its search page.',
        'lang': 'multi',
        'homepage': 'https://nyaa.si',
        'icon': 'https://nyaa.si/static/favicon.png',
        'network': ['nyaa.si'],
        'config': [
            {
                'name': 'category',
                'label': 'Category',
                'type': 'select',
                'options': ['English-translated', 'Non-English-translated', 'Raw', 'All anime'],
                'default': 'English-translated',
            },
            {
                'name': 'filter',
                'label': 'Uploaders',
                'type': 'select',
                'options': ['No filter', 'No remakes', 'Trusted only'],
                'default': 'No filter',
            },
        ],
    },
}


# Sites on MangaLib's platform differ only in these: each plugin.js is written
# from mangalib/plugin.js, so a fix there reaches them all on the next build.
VARIANTS = {
    'slashlib': [
        ("const SITE = 'https://mangalib.me/'", "const SITE = 'https://slashlib.me/'"),
        ("const SITE_ID = '1'", "const SITE_ID = '2'"),
        ('(mangalib.me)', '(slashlib.me)'),
        ('MangaLib', 'SlashLib'),
    ],
}


def write_variants(root: pathlib.Path) -> None:
    source = (root / 'mangalib' / 'plugin.js').read_text(encoding='utf-8')
    for plugin_id, swaps in VARIANTS.items():
        code = source
        for old, new in swaps:
            if old not in code:
                raise SystemExit(f'{plugin_id}: {old!r} is no longer in mangalib/plugin.js')
            code = code.replace(old, new)
        code = '// Written by build.py from mangalib/plugin.js; change that one.\n' + code
        (root / plugin_id).mkdir(exist_ok=True)
        (root / plugin_id / 'plugin.js').write_text(code, encoding='utf-8', newline='\n')


def main(base: str) -> None:
    base = base.rstrip('/')
    root = pathlib.Path(__file__).parent
    entries = []

    write_variants(root)

    for plugin_id, meta in PLUGINS.items():
        code = (root / plugin_id / 'plugin.js').read_bytes()
        optional = {key: meta[key] for key in ('homepage', 'icon', 'minNodeVersion', 'config') if key in meta}
        manifest = {
            'id': plugin_id,
            'name': meta['name'],
            'version': meta['version'],
            'type': meta.get('type', 'torrent-provider'),
            'author': meta['author'],
            'description': meta['description'],
            'lang': meta['lang'],
            **optional,
            'network': meta['network'],
            'payload': f'{base}/{plugin_id}/plugin.js',
            'sha256': hashlib.sha256(code).hexdigest(),
        }
        (root / plugin_id / 'manifest.json').write_text(json.dumps(manifest, indent='\t', ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')

        entries.append({
            'manifest': f'{base}/{plugin_id}/manifest.json',
            'id': plugin_id,
            'name': meta['name'],
            'version': meta['version'],
            'type': meta.get('type', 'torrent-provider'),
            'author': meta['author'],
            'description': meta['description'],
            'lang': meta['lang'],
            **({'icon': meta['icon']} if 'icon' in meta else {}),
        })

    repository = {'name': 'Mediary plugins', 'plugins': entries}
    (root / 'repository.json').write_text(json.dumps(repository, indent='\t', ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(f'{len(entries)} plugins; add {base}/repository.json in Mediary')


if __name__ == '__main__':
    main(sys.argv[1])
