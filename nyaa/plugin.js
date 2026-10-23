// Searches Nyaa (nyaa.si), the largest public tracker of anime releases, by
// reading its search page: Nyaa has no JSON API, and its RSS lacks the peers.
//
// A page holds 75 rows, and the newest 75 may not reach what is wanted: for a
// long show, the episode asked; for a first season, anything past its sequel's
// weekly releases. So the search asks twice: for the episode by number, or for
// the newest without one, and for the title's best-seeded releases, where the
// batches are.

const SITE = 'https://nyaa.si'

/** @type {Record<string, string>} */
const CATEGORIES = {
	'English-translated': '1_2',
	'Non-English-translated': '1_3',
	Raw: '1_4',
	'All anime': '1_0'
}

/** @type {Record<string, string>} */
const FILTERS = {
	'No filter': '0',
	'No remakes': '1',
	'Trusted only': '2'
}

/** @type {Record<string, number>} */
const UNITS = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 }

/** @param {string} text */
function bytes(text) {
	const match = /([\d.]+)\s*(B|KiB|MiB|GiB|TiB)/.exec(text)
	return match ? Math.round(Number(match[1]) * UNITS[match[2]]) : 0
}

/** @param {string} text */
function count(text) {
	return Number.parseInt(text.trim(), 10) || 0
}

/**
 * @param {string} query
 * @param {string} sort
 * @returns {Promise<Release[]>}
 */
async function page(query, sort) {
	const params = [
		'f=' + (FILTERS[config.filter] ?? '0'),
		'c=' + (CATEGORIES[config.category] ?? '1_2'),
		'q=' + encodeURIComponent(query),
		...(sort ? ['s=' + sort, 'o=desc'] : [])
	].join('&')

	const res = await fetch(`${SITE}/?${params}`)
	if (!res.ok) {
		throw new Error(`Nyaa answered ${res.status}`)
	}

	return parseHTML(await res.text())
		.find('table.torrent-list tbody tr')
		.map((_, row) => {
			const cells = row.find('td')
			// A row with comments has a link to them before the title's.
			const name = cells.eq(1).find('a[href^="/view/"]:not(.comments)').first()
			const view = name.attr('href') ?? ''
			const torrent = cells.eq(2).find('a[href$=".torrent"]').attr('href')
			const stamp = Number(cells.eq(4).attr('data-timestamp'))
			const seeders = count(cells.eq(5).text())

			return {
				title: (name.attr('title') ?? name.text()).trim(),
				magnet: cells.eq(2).find('a[href^="magnet:"]').attr('href'),
				link: torrent ? SITE + torrent : undefined,
				size: bytes(cells.eq(3).text()),
				seeders,
				peers: seeders + count(cells.eq(6).text()),
				grabs: count(cells.eq(7).text()),
				publishedAt: stamp ? new Date(stamp * 1000).toISOString() : undefined,
				pageUrl: view ? SITE + view : undefined
			}
		})
		.filter(release => release.title && (release.magnet || release.link))
}

class Provider {
	/**
	 * @param {SearchRequest} request
	 * @returns {Promise<Release[]>}
	 */
	async search(request) {
		const query = request.query.trim()
		if (!query) {
			return []
		}

		const first = request.episode ? `${query} ${String(request.episode).padStart(2, '0')}` : query
		const asks = [page(first, ''), page(query, 'seeders')]

		/** @type {Map<string, Release>} */
		const found = new Map()
		for (const releases of await Promise.all(asks)) {
			for (const release of releases) {
				found.set(release.pageUrl ?? release.title, release)
			}
		}

		return [...found.values()]
	}
}
