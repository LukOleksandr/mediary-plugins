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
        'version': '1.0.0',
        'author': 'Mediary community',
        'description': 'Russian dubs of anime from AniLiberty (aniliberty.top), formerly AniLibria: whole-season torrents through the site\'s public API.',
        'lang': 'ru',
        'homepage': 'https://aniliberty.top',
        'icon': 'https://cdn.anilibria.top/static/apple-touch-icon.png',
        # Magnets carry everything; no .torrent is fetched from anywhere else.
        'network': ['aniliberty.top'],
    },
    'nyaa': {
        'name': 'Nyaa',
        'version': '1.0.0',
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


def main(base: str) -> None:
    base = base.rstrip('/')
    root = pathlib.Path(__file__).parent
    entries = []

    for plugin_id, meta in PLUGINS.items():
        code = (root / plugin_id / 'plugin.js').read_bytes()
        optional = {key: meta[key] for key in ('homepage', 'icon', 'minNodeVersion', 'config') if key in meta}
        manifest = {
            'id': plugin_id,
            'name': meta['name'],
            'version': meta['version'],
            'type': 'torrent-provider',
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
            'type': 'torrent-provider',
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
