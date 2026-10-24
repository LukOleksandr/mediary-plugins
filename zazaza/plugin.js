// Reads manga from ZazaZa (a.zazaza.me), a site of the Grouple network that
// ReadManga belongs to, by its pages.
//
// The reader page signs each image's address, and outside a browser the image
// server (behind DDoS-Guard) answers a signed address with a decoy. The same
// address without its signature gives the image, so that is what this plugin
// hands the node — as Grouple plugins elsewhere do. It works around the site's
// protection and may stop working whenever the site changes it.

const SITE = 'https://a.zazaza.me'

/** @param {string} text */
function squash(text) {
	return text.replace(/\s+/g, ' ').trim()
}

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function html(url) {
	const res = await fetch(url, { headers: { Accept: 'text/html', Referer: SITE + '/' } })
	if (res.status === 404) {
		throw new Error('ZazaZa has no such page any more')
	}
	if (!res.ok) {
		throw new Error(`ZazaZa answered ${res.status}`)
	}

	return res.text()
}

/**
 * @typedef {{ value?: string, link?: string, names?: string[], year?: number | string,
 *   elementId?: { typeName?: string } }} Suggestion
 */

// A chapter's number is ten times the number: 1470 is 147, 1475 is 147.5.
/** @param {string | undefined} raw */
function chapterNumber(raw) {
	const value = Number(raw)
	return raw && Number.isFinite(value) ? String(value / 10) : ''
}

// "Кофейный домик Переводчик, Световой Раскат (Переводчик)" — the teams.
/** @param {string | undefined} raw */
function teams(raw) {
	return (raw ?? '')
		.split(',')
		.map(name => name.replace(/\(?Переводчик\)?/g, '').trim())
		.filter(Boolean)
}

class Provider {
	/**
	 * @param {MangaSearchRequest} request
	 * @returns {Promise<Series[]>}
	 */
	async search(request) {
		const res = await fetch(`${SITE}/search/suggestion?query=${encodeURIComponent(request.query)}`, {
			headers: { Accept: 'application/json', Referer: SITE + '/' }
		})
		if (!res.ok) {
			throw new Error(`ZazaZa answered ${res.status}`)
		}

		const body = /** @type {{ suggestions?: Suggestion[] }} */ (await res.json())

		// Suggestions name titles on the network's other sites too; only this
		// one's are read here.
		return (body.suggestions ?? [])
			.filter(s => s.link?.startsWith('/') && s.value)
			.map(s => ({
				id: (s.link ?? '').slice(1),
				title: s.value ?? '',
				detail: [...(s.names ?? []).slice(0, 2), s.elementId?.typeName, s.year].filter(Boolean).join(' · ')
			}))
	}

	/**
	 * @param {string} seriesId
	 * @returns {Promise<MangaChapter[]>}
	 */
	async chapters(seriesId) {
		const page = await html(`${SITE}/${encodeURIComponent(seriesId)}`)
		if (page.includes('Запрещена публикация произведения по копирайту')) {
			throw new Error('ZazaZa took this title down at its rights holder’s request')
		}

		return parseHTML(page)
			.find('tr.item-row')
			.map((_, row) => {
				const cell = row.find('td.item-title')
				const link = cell.find('a.chapter-link').first()
				const raw = row.find('td.date').attr('data-date-raw')

				return {
					id: (link.attr('href') ?? '').replace(/^\/+/, '').replace(/[?#].*$/, ''),
					number: chapterNumber(cell.attr('data-num')),
					volume: cell.attr('data-vol'),
					// "15 - 147 Земля без героя": the volume and number come apart.
					title: squash(link.text()).replace(/^\d+\s*-\s*[\d.]+\s*/, '') || undefined,
					language: 'ru',
					groups: teams(link.attr('title')),
					publishedAt: raw ? raw.replace(' ', 'T') + 'Z' : undefined
				}
			})
			.filter(chapter => chapter.id.includes('/'))
	}

	/**
	 * @param {string} chapterId
	 * @returns {Promise<MangaPage[]>}
	 */
	async pages(chapterId) {
		// mtr=true: the pages, not a warning about mature content.
		const page = await html(`${SITE}/${chapterId.split('/').map(encodeURIComponent).join('/')}?mtr=true`)

		const start = page.indexOf('rm_h.readerInit(')
		const end = start < 0 ? -1 : page.indexOf(');', start)
		if (start < 0 || end < 0) {
			throw new Error('ZazaZa shows no pages for this chapter; it may be behind an account')
		}

		/** @type {MangaPage[]} */
		const pages = []
		for (const match of page.slice(start, end).matchAll(/\[['"](.*?)['"],\s*['"](.*?)['"],\s*['"](.*?)['"]/g)) {
			const [, host = '', middle = '', path = ''] = match
			let url = middle.endsWith('/manga/') ? host + path : middle + host + path
			if (url.startsWith('//')) {
				url = 'https:' + url
			}
			if (url.includes('one-way.work')) {
				url = url.split('?')[0] ?? url
			}
			pages.push({ url, referer: SITE + '/' })
		}

		if (pages.length === 0) {
			throw new Error('ZazaZa shows no pages for this chapter')
		}

		return pages
	}
}
