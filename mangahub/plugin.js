// Reads manga from MangaHub (mangahub.ru) by its pages: the site has no API of
// its own for readers. A title's chapters are one page, however many; a
// chapter's page lists every scan, on image hosts that answer only with the
// site as the referrer.

const SITE = 'https://mangahub.ru'

/**
 * @param {string} path
 * @returns {Promise<Selection>}
 */
async function page(path) {
	const res = await fetch(SITE + path, { headers: { Accept: 'text/html' } })
	if (res.status === 404) {
		throw new Error('MangaHub has no such page any more')
	}
	if (!res.ok) {
		throw new Error(`MangaHub answered ${res.status}`)
	}

	return parseHTML(await res.text())
}

/** @param {string} text */
function squash(text) {
	return text.replace(/\s+/g, ' ').trim()
}

// "21.08.2026" as ISO 8601.
/** @param {string} text */
function date(text) {
	const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(text)
	return match ? `${match[3]}-${match[2]}-${match[1]}T00:00:00Z` : undefined
}

class Provider {
	/**
	 * @param {MangaSearchRequest} request
	 * @returns {Promise<Series[]>}
	 */
	async search(request) {
		const doc = await page(`/suggestions?query=${encodeURIComponent(request.query)}`)

		return doc
			.find('a[href^="/title/"]')
			.map((_, link) => ({
				id: (link.attr('href') ?? '').replace(/^\/title\//, ''),
				title: squash(link.find('.fw-bold').text()),
				detail: link
					.find('.text-muted')
					.map((__, el) => squash(el.text()))
					.filter(Boolean)
					.join(' · ')
			}))
			.filter(series => series.id && series.title)
	}

	/**
	 * @param {string} seriesId
	 * @returns {Promise<MangaChapter[]>}
	 */
	async chapters(seriesId) {
		const doc = await page(`/title/${encodeURIComponent(seriesId)}/chapters`)

		return doc.find('div.detail-item').map((_, row) => {
			const link = row.find('a[href^="/read/"]').first()
			// "Том 15. Глава 147 - Земля без Героя"
			const label = squash(link.text())
			const [head, ...rest] = label.split(' - ')

			return {
				id: (link.attr('href') ?? '').replace(/^\/read\//, ''),
				number: /Глава\s+(\d+(?:\.\d+)?)/.exec(head)?.[1] ?? row.attr('data-item-number') ?? '',
				volume: /Том\s+(\d+(?:\.\d+)?)/.exec(head)?.[1],
				title: rest.join(' - ') || undefined,
				language: 'ru',
				publishedAt: date(row.find('.detail-item-date').text())
			}
		})
	}

	/**
	 * @param {string} chapterId
	 * @returns {Promise<MangaPage[]>}
	 */
	async pages(chapterId) {
		const doc = await page(`/read/${encodeURIComponent(chapterId)}`)

		const pages = doc.find('img.reader-viewer-img').map((_, img) => {
			const src = img.attr('data-src') || img.attr('src') || ''
			return { url: src.startsWith('//') ? 'https:' + src : src, referer: SITE + '/' }
		})
		if (pages.length === 0) {
			throw new Error('MangaHub shows no pages for this chapter; it may be behind an account')
		}

		return pages
	}
}
