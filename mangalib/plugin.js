// Reads manga from MangaLib (mangalib.me) through the API its own site uses.
//
// A chapter can come in several translations, the site's "branches": each is a
// chapter of its own here, with its team as the group. Pages are on image
// servers the site names in its constants, and they answer only with the site
// as the referrer.

const API = 'https://api2.mangalib.me/api'
const SITE = 'https://mangalib.me/'
// MangaLib's id among the sites that share this API.
const SITE_ID = '1'

/**
 * @typedef {{ id?: number, name?: string, rus_name?: string, eng_name?: string, slug_url?: string,
 *   releaseDateString?: string, type?: { label?: string } }} SiteSeries
 * @typedef {{ name?: string }} Team
 * @typedef {{ branch_id?: number | null, created_at?: string, teams?: Team[] }} Branch
 * @typedef {{ volume?: string, number?: string, name?: string | null, branches?: Branch[] }} SiteChapter
 * @typedef {{ url?: string }} SitePage
 * @typedef {{ id?: string, url?: string, site_ids?: number[] }} ImageServer
 */

/**
 * @param {string} path
 * @returns {Promise<unknown>}
 */
async function api(path) {
	const res = await fetch(API + path, { headers: { Accept: 'application/json', 'Site-Id': SITE_ID, Referer: SITE } })
	if (res.status === 401 || res.status === 403) {
		throw new Error('MangaLib keeps this behind an account')
	}
	if (!res.ok) {
		throw new Error(`MangaLib answered ${res.status}`)
	}

	const body = /** @type {{ data?: unknown }} */ (await res.json())

	return body.data
}

// A chapter's id carries what the site needs to find it again.
const SEP = '~'

/**
 * @param {string} slug
 * @param {SiteChapter} chapter
 * @param {Branch} branch
 */
function chapterId(slug, chapter, branch) {
	return [slug, chapter.volume ?? '', chapter.number ?? '', branch.branch_id ?? ''].join(SEP)
}

class Provider {
	/**
	 * @param {MangaSearchRequest} request
	 * @returns {Promise<Series[]>}
	 */
	async search(request) {
		const found = /** @type {SiteSeries[]} */ ((await api(`/manga?q=${encodeURIComponent(request.query)}`)) ?? [])

		return found
			.filter(s => s.slug_url)
			.map(s => ({
				id: s.slug_url ?? '',
				title: s.name || s.eng_name || s.rus_name || '',
				detail: [s.rus_name, s.type?.label, s.releaseDateString].filter(Boolean).join(' · ')
			}))
	}

	/**
	 * @param {string} seriesId
	 * @returns {Promise<MangaChapter[]>}
	 */
	async chapters(seriesId) {
		const list = /** @type {SiteChapter[]} */ ((await api(`/manga/${encodeURIComponent(seriesId)}/chapters`)) ?? [])

		/** @type {MangaChapter[]} */
		const out = []
		for (const chapter of list) {
			for (const branch of chapter.branches ?? []) {
				out.push({
					id: chapterId(seriesId, chapter, branch),
					number: chapter.number ?? '',
					volume: chapter.volume,
					title: chapter.name ?? undefined,
					language: 'ru',
					groups: (branch.teams ?? []).map(team => team.name ?? '').filter(Boolean),
					publishedAt: branch.created_at
				})
			}
		}

		return out
	}

	/**
	 * @param {string} chapterId
	 * @returns {Promise<MangaPage[]>}
	 */
	async pages(chapterId) {
		const [slug, volume, number, branch] = chapterId.split(SEP)
		const query = `number=${encodeURIComponent(number)}&volume=${encodeURIComponent(volume)}` +
			(branch ? `&branch_id=${encodeURIComponent(branch)}` : '')

		const chapter = /** @type {{ pages?: SitePage[] }} */ (
			(await api(`/manga/${encodeURIComponent(slug)}/chapter?${query}`)) ?? {}
		)
		const constants = /** @type {{ imageServers?: ImageServer[] }} */ (
			(await api('/constants?fields[]=imageServers')) ?? {}
		)

		const wanted = config.server || 'main'
		const server = (constants.imageServers ?? []).find(
			s => s.id === wanted && (s.site_ids ?? []).includes(Number(SITE_ID)) && s.url
		)
		if (!server?.url) {
			throw new Error(`MangaLib names no "${wanted}" image server`)
		}

		const pages = chapter.pages ?? []
		if (pages.length === 0) {
			throw new Error('MangaLib gives no pages for this chapter')
		}

		return pages.map(page => ({
			url: server.url + '/' + (page.url ?? '').replace(/^\/+/, ''),
			referer: SITE
		}))
	}
}
