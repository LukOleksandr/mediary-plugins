// Searches AniLiberty (once AniLibria), a Russian dubbing team, through its
// public API. A release on the site is one title, with a torrent or two that
// hold every episode out so far.
//
// The site's search is loose: "Kimetsu no Yaiba" finds every arc and film
// besides the first season, and each of their batches holds an episode 5. So
// only a release named as the title is named is kept, word for word.

const SITE = 'https://aniliberty.top'
const API = SITE + '/api/v1'

// One request finds the releases and each costs one more; a call gets ten.
const MAX_RELEASES = 4

/**
 * @typedef {{ main?: string | null, english?: string | null, alternative?: string | null }} Name
 * @typedef {{ id?: number, alias?: string, year?: number | null, name?: Name,
 *   is_blocked_by_copyrights?: boolean }} SiteRelease
 * @typedef {{ label?: string, hash?: string, magnet?: string, size?: number, seeders?: number,
 *   leechers?: number, completed_times?: number, updated_at?: string }} SiteTorrent
 */

/**
 * A name as words to compare: "JUJUTSU KAISEN Season 2" and "Jujutsu Kaisen
 * 2nd Season" are the same, and so are "HUNTER×HUNTER" and "Hunter x Hunter".
 * @param {string} name
 */
function words(name) {
	return name
		.toLowerCase()
		.replace(/×/g, ' x ')
		.replace(/ё/g, 'е')
		.replace(/[^a-z0-9à-ɏа-џґ]+/g, ' ')
		.replace(/\b(\d+)(?:st|nd|rd|th) season\b/g, 'season $1')
		.replace(/\bs(\d+)\b/g, 'season $1')
		.replace(/\s+/g, ' ')
		.trim()
}

/** @param {SiteRelease} release */
function namesOf(release) {
	const name = release.name ?? {}
	// "Alternative" is taken whole, though it is often a list: a sequel's
	// "Поднятие уровня, Solo Leveling" names the series, not the season.
	return [name.main, name.english, name.alternative]
		.filter(n => typeof n === 'string')
		.map(n => words(/** @type {string} */ (n)))
		.filter(Boolean)
}

/**
 * @param {string} url
 * @returns {Promise<unknown>}
 */
async function get(url) {
	const res = await fetch(url, { headers: { Accept: 'application/json' } })
	if (!res.ok) {
		throw new Error(`AniLiberty answered ${res.status}`)
	}
	return res.json()
}

class Provider {
	/**
	 * @param {SearchRequest} request
	 * @returns {Promise<Release[]>}
	 */
	async search(request) {
		// The node adds " S02" for indexers that name seasons so; the site does not.
		const query = request.query.replace(/\s+S\d{1,2}$/i, '').trim()
		if (!words(query)) {
			return []
		}

		const wanted = new Set([query, ...request.titles].map(words).filter(Boolean))

		const found = await get(`${API}/app/search/releases?query=${encodeURIComponent(query)}`)
		if (!Array.isArray(found)) {
			throw new Error('AniLiberty answered the search with something other than a list')
		}

		const releases = /** @type {SiteRelease[]} */ (found).filter(release => {
			if (!release.id || release.is_blocked_by_copyrights) {
				return false
			}
			// A remake can share its name with the original.
			if (request.year && release.year && Math.abs(release.year - request.year) > 1) {
				return false
			}
			return namesOf(release).some(name => wanted.has(name))
		})

		/** @type {Release[]} */
		const results = []

		for (const release of releases.slice(0, MAX_RELEASES)) {
			const torrents = await get(`${API}/anime/torrents/release/${release.id}`)
			if (!Array.isArray(torrents)) {
				continue
			}

			const page = release.alias ? `${SITE}/anime/releases/release/${encodeURIComponent(release.alias)}` : undefined

			for (const torrent of /** @type {SiteTorrent[]} */ (torrents)) {
				if (!torrent.label || !(torrent.magnet || torrent.hash)) {
					continue
				}

				results.push({
					title: torrent.label,
					magnet: torrent.magnet,
					infoHash: torrent.hash,
					size: torrent.size,
					seeders: torrent.seeders,
					peers: (torrent.seeders ?? 0) + (torrent.leechers ?? 0),
					grabs: torrent.completed_times,
					publishedAt: torrent.updated_at,
					pageUrl: page
				})
			}
		}

		return results
	}
}
