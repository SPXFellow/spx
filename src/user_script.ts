// ==UserScript==
// @author        SPGoding
// @connect       minecraft.net
// @connect       spgoding.com
// @description   Minecraft.net blog article to BBCode converter
// @downloadURL   https://spx.spgoding.com/user-script
// @grant         GM_setClipboard
// @grant         GM_xmlhttpRequest
// @homepage      https://github.com/SPGoding/spx
// @include       https://www.minecraft.net/en-us/article/*
// @include       https://www.minecraft.net/zh-hans/article/*
// @include       https://twitter.com/*/status/*
// @include       https://mobile.twitter.com/*/status/*
// @include       https://feedback.minecraft.net/hc/en-us/articles/*
// @include       https://help.minecraft.net/hc/en-us/articles/*
// @name          SPX
// @version       1.2.2
// ==/UserScript==

/// <reference types="@types/tampermonkey">

type ResolvedBugs = Partial<import('./cache/bug').ResolvedBugCache>

interface Context {
	author?: string,
	bugs: ResolvedBugs,
	disablePunctuationConverter?: boolean,
	inList?: boolean,
	title: string,
	translator: string,
	url: string,
}

interface Tweet {
	date: string,
	source: string,
	text: string,
	tweetLink: string,
	urls: string,
	userName: string,
	userTag: string,
	lang: string
}

(() => {
	// 看不惯，别看。看美国人的脚本去。

	// Minecraft.net START
	const BugsCenter = 'https://spx.spgoding.com/bugs'

	async function minecraftNet() {
		const url = document.location.toString()
		if (url.match(/^https:\/\/www\.minecraft\.net\/(?:[a-z-]+)\/article\//)) {
			console.info('[SPX] Activated')

			const pointerModifier = document.getElementsByClassName('article-attribution-container').item(0) as HTMLDivElement
			pointerModifier.style.pointerEvents = 'inherit'

			const button = document.createElement('button')
			button.classList.add('btn', 'btn-primary', 'btn-sm', 'btn-primary--grow', 'spx-converter-ignored')
			button.innerText = 'Copy BBCode'
			button.onclick = async () => {
				button.innerText = 'Processing...'
				const bbcode = await convertMCArticleToBBCode(document, url, '// TODO //')
				GM_setClipboard(bbcode, { type: 'text', mimetype: 'text/plain' })
				button.innerText = 'Copied BBCode!'
				setTimeout(() => button.innerText = 'Copy BBCode', 5_000)
			}

			const container = document.getElementsByClassName('attribution').item(0) as HTMLDivElement
			container.append(button)
		}
	}

	function feedback() {
		console.info('[SPX] Activated')

		const button = document.createElement('a')
		button.classList.add('navLink')
		button.innerText = 'Copy BBCode'
		button.onclick = async () => {
			button.innerText = 'Processing...'
			const bbcode = await convertFeedbackArticleToBBCode(document, location.href)
			GM_setClipboard(bbcode, { type: 'text', mimetype: 'text/plain' })
			button.innerText = 'Copied BBCode!'
			setTimeout(() => button.innerText = 'Copy BBCode', 5_000)
		}

		document.querySelector('.topNavbar nav')!.append(button)
	}

	function help() {
		console.info('[SPX] Activated')

		const button = document.createElement('a')
		button.classList.add('navLink')
		button.innerText = 'Copy BBCode'
		button.onclick = async () => {
			button.innerText = 'Processing...'
			const bbcode = await convertHelpArticleToBBCode(document, location.href)
			GM_setClipboard(bbcode, { type: 'text', mimetype: 'text/plain' })
			button.innerText = 'Copied BBCode!'
			setTimeout(() => button.innerText = 'Copy BBCode', 5_000)
		}

		const nav = document.createElement('nav')
		nav.classList.add('my-0')
		nav.append(button)

		document.querySelector('.topNavbar .d-flex')!.append(nav)
	}

	async function getBugs(): Promise<ResolvedBugs> {
		return new Promise((rs, rj) => {
			GM_xmlhttpRequest({
				method: 'GET',
				url: BugsCenter,
				fetch: true,
				nocache: true,
				timeout: 7_000,
				onload: r => {
					try {
						rs(JSON.parse(r.responseText))
					} catch (e) {
						rj(e)
					}
				},
				onabort: () => rj(new Error('Aborted')),
				onerror: e => rj(e),
				ontimeout: () => rj(new Error('Time out')),
			})
		})
	}

	async function convertMCArticleToBBCode(html: Document, articleUrl: string, translator = '？？？') {
		const articleType = getArticleType(html)
		const versionType = getVersionType(articleUrl)

		let bugs: ResolvedBugs
		try {
			bugs = await getBugs()
		} catch (e) {
			bugs = {}
			console.error('[convertMCArticleToBBCode#getBugs]', e)
		}

		const beginning = getBeginning(articleType, versionType)
		const heroImage = getHeroImage(html, articleType)
		const content = await getContent(html, {
			bugs,
			title: html.title.split(' | ').slice(0, -1).join(' | '),
			translator,
			url: articleUrl,
		})
		const ending = getEnding(articleType, versionType)

		const ans = `${beginning}${heroImage}${content}[/indent][/indent]${ending}`

		return ans
	}

	/**
	 * Get the hero image (head image) of an article as the form of a BBCode string.
	 * @param html An HTML Document.
	 */
	function getHeroImage(html: Document, articleType: string | undefined) {
		const category = articleType ? `\n[backcolor=Black][color=White][font="Noto Sans",sans-serif][b]${articleType}[/b][/font][/color][/backcolor][/align]` : ''
		const img = html.getElementsByClassName('article-head__image')[0] as HTMLImageElement | undefined
		if (!img) {
			return `[postbg]bg3.png[/postbg]\n\n[align=center]${category}[indent][indent]\n`
		}
		const src = img.src
		const ans = `[postbg]bg3.png[/postbg][align=center][img=1200,513]${resolveUrl(src)}[/img]\n${category}[indent][indent]\n`

		return ans
	}

	/**
	 * Get the content of an article as the form of a BBCode string.
	 * @param html An HTML Document.
	 */
	async function getContent(html: Document, ctx: Context) {
		const rootDiv = html.getElementsByClassName('article-body')[0] as HTMLElement
		let ans = await converters.recurse(rootDiv, ctx)

		// Get the server URL if it exists.
		const serverUrls = ans.match(/(https:\/\/launcher.mojang.com\/.+\/server.jar)/)
		let serverUrl = ''
		if (serverUrls) {
			serverUrl = serverUrls[0]
		}
		// Remove the text after '】'
		ans = ans.slice(0, ans.lastIndexOf('】') + 1)
		// Remove 'GET THE SNAPSHOT/PRE-RELEASE/RELEASE-CANDIDATE/RELEASE' for releasing
		let index = ans.toLowerCase().lastIndexOf('[size=6][b][color=silver]get the snapshot[/color][/b][/size]')
		if (index === -1) {
			index = ans.toLowerCase().lastIndexOf('[size=6][b][color=silver]get the pre-release[/color][/b][/size]')
		}
		if (index === -1) {
			index = ans.toLowerCase().lastIndexOf('[size=6][b][color=silver]get the release[/color][/b][/size]')
		}
		if (index === -1) {
			index = ans.toLowerCase().lastIndexOf('[size=6][b][color=silver]get the release candidate[/color][/b][/size]')
		}
		if (index !== -1) {
			ans = ans.slice(0, index)
		}
		// Add spaces between texts and '[x'.
		ans = ans.replace(/([a-zA-Z0-9\-._])(\[[A-Za-z])/g, '$1 $2')
		// Add spaces between '[/x]' and texts.
		ans = ans.replace(/(\[\/[^\]]+?\])([a-zA-Z0-9\-._])/g, '$1 $2')
		// Append the server URL if it exists.
		if (serverUrl) {
			ans += `\n[align=center][table=70%,#EDFBFF]
[tr][td=2,1][align=center][size=3][color=#D6D604][b]官方服务端下载地址[/b][/color][/size][/align][/td][/tr]
[tr][td][align=center][url=${serverUrl}]Minecraft server.jar[/url][/align][/td][/tr]
[/table][/align]`
		}

		return ans
	}

	async function convertFeedbackArticleToBBCode(html: Document, articleUrl: string, translator = '？？？') {
		const title = html.title.slice(0, html.title.lastIndexOf(' – Minecraft Feedback'))
		const ctx = {
			bugs: {},
			title: title,
			translator,
			url: articleUrl,
		}

		let versionType = VersionType.Normal

		if (document.querySelector('[title="Beta Information and Changelogs"]')) {
			versionType = VersionType.BedrockBeta
		} else if (document.querySelector('[title="Release Changelogs"]')) {
			versionType = VersionType.BedrockRelease
		}

		const content = await getFeedbackContent(html, ctx)

		const ans = `${getBeginning('news', versionType)}[size=6][b][color=Silver]${title}[/color][/b][/size]
${translateMachinely(`[size=6][b]${title}[/b][/size]`, ctx)}\n\n${content.replace(
	/\[size=2\]\[color=Silver\]\[b\]PLEASE READ before participating in the Minecraft Beta: \[\/b\]\[\/color\]\[\/size\].*?\[\/list\]/msi,
	'')}[/indent][/indent]\n
[b]【${ctx.translator} 译自[url=${ctx.url}][color=#388d40][u]feedback.minecraft.net 哪 年 哪 月 哪 日发布的 ${ctx.title}[/u][/color][/url]】[/b]
【本文排版借助了：[url=https://spx.spgoding.com][color=#388d40][u]SPX[/u][/color][/url]】\n\n${getEnding('news', versionType)}`

		return ans
	}

	async function convertHelpArticleToBBCode(html: Document, articleUrl: string, translator = '？？？') {
		const title = html.title.slice(0, html.title.lastIndexOf(' – Home'))
		const ctx = {
			bugs: {},
			title: title,
			translator,
			url: articleUrl,
		}
		const content = await getHelpContent(html, ctx)

		const ans = `[size=6][b][color=Silver]${title}[/color][/b][/size]
${translateMachinely(`[size=6][b]${title}[/b][/size]`, ctx)}\n\n${content}[/indent][/indent]\n
[b]【${ctx.translator} 译自[url=${ctx.url}][color=#388d40][u]help.minecraft.net 哪 年 哪 月 哪 日发布的 ${ctx.title}[/u][/color][/url]】[/b]
【本文排版借助了：[url=https://spx.spgoding.com][color=#388d40][u]SPX[/u][/color][/url]】\n\n`

		return ans
	}

	/**
	 * Get the content of an article as the form of a BBCode string.
	 * @param html An HTML Document.
	 */
	async function getFeedbackContent(html: Document, ctx: Context) {
		const rootSection = html.getElementsByClassName('article-info')[0] as HTMLElement
		let ans = await converters.recurse(rootSection, ctx)

		// Add spaces between texts and '[x'.
		ans = ans.replace(/([a-zA-Z0-9\-._])(\[[A-Za-z])/g, '$1 $2')
		// Add spaces between '[/x]' and texts.
		ans = ans.replace(/(\[\/[^\]]+?\])([a-zA-Z0-9\-._])/g, '$1 $2')

		return ans
	}

	/**
	 * Get the content of an article as the form of a BBCode string.
	 * @param html An HTML Document.
	 */
		async function getHelpContent(html: Document, ctx: Context) {
		const rootSection = html.getElementsByClassName('article-body')[0] as HTMLElement // Yep, this is the only difference.
		let ans = await converters.recurse(rootSection, ctx)

		// Add spaces between texts and '[x'.
		ans = ans.replace(/([a-zA-Z0-9\-._])(\[[A-Za-z])/g, '$1 $2')
		// Add spaces between '[/x]' and texts.
		ans = ans.replace(/(\[\/[^\]]+?\])([a-zA-Z0-9\-._])/g, '$1 $2')

		return ans
	}

	const converters = {
		/**
		 * Converts a ChildNode to a BBCode string according to the type of the node.
		 */
		convert: async (node: ChildNode, ctx: Context): Promise<string> => {
			if ((node as HTMLElement).classList?.contains('spx-converter-ignored')) {
				return ''
			}
			switch (node.nodeName) {
				case 'A':
					return converters.a(node as HTMLAnchorElement, ctx)
				case 'B':
				case 'STRONG':
					return converters.strong(node as HTMLElement, ctx)
				case 'BLOCKQUOTE':
					return converters.blockquote(node as HTMLQuoteElement, ctx)
				case 'BR':
					return converters.br()
				case 'CITE':
					return converters.cite(node as HTMLElement, ctx)
				case 'CODE':
					return converters.code(node as HTMLElement, ctx)
				case 'DIV':
				case 'SECTION':
					return converters.div(node as HTMLDivElement, ctx)
				case 'DD':
					return converters.dd(node as HTMLElement, ctx)
				case 'DL':
					return converters.dl(node as HTMLElement, ctx)
				case 'DT':
					return converters.dt()
				case 'EM':
					return converters.em(node as HTMLElement, ctx)
				case 'H1':
					return converters.h1(node as HTMLElement, ctx)
				case 'H2':
					return converters.h2(node as HTMLElement, ctx)
				case 'H3':
					return converters.h3(node as HTMLElement, ctx)
				case 'H4':
					return converters.h4(node as HTMLElement, ctx)
				case 'I':
					return converters.i(node as HTMLElement, ctx)
				case 'IMG':
					return converters.img(node as HTMLImageElement)
				case 'LI':
					return converters.li(node as HTMLElement, ctx)
				case 'OL':
					return converters.ol(node as HTMLElement, ctx)
				case 'P':
					return converters.p(node as HTMLElement, ctx)
				case 'PICTURE': // TODO: If picture contains important img in the future. Then just attain the last <img> element in the <picture> element.
					return converters.picture(node as HTMLElement, ctx)
				case 'SPAN':
					return converters.span(node as HTMLElement, ctx)
				case 'TABLE':
					return converters.table(node as HTMLElement, ctx)
				case 'TBODY':
					return converters.tbody(node as HTMLElement, ctx)
				case 'TH':
				case 'TD':
					return converters.td(node as HTMLElement, ctx)
				case 'TR':
					return converters.tr(node as HTMLElement, ctx)
				case 'UL':
					return converters.ul(node as HTMLElement, ctx)
				case '#text':
					if (node) {
						return ((node as Text).textContent as string)
							.replace(/[\n\r\t]+/g, '').replace(/\s{2,}/g, '')
					} else {
						return ''
					}
				case 'BUTTON':
				case 'H5':
				case 'NAV':
				case 'svg':
				case 'SCRIPT':
					if (node) {
						return node.textContent ? node.textContent : ''
					} else {
						return ''
					}
				default:
					console.warn(`Unknown type: '${node.nodeName}'.`)
					if (node) {
						return node.textContent ? node.textContent : ''
					} else {
						return ''
					}
			}
		},
		/**
		 * Convert child nodes of an HTMLElement to a BBCode string.
		 */
		recurse: async (ele: HTMLElement, ctx: Context) => {
			let ans = ''

			if (!ele) {
				return ans
			}

			for (const child of Array.from(ele.childNodes)) {
				ans += await converters.convert(child, ctx)
			}

			ans = removeLastLinebreak(ans)

			return ans
		},
		a: async (anchor: HTMLAnchorElement, ctx: Context) => {
			const url = resolveUrl(anchor.href)
			let ans
			if (url) {
				ans = `[url=${url}][color=#388d40]${await converters.recurse(anchor, ctx)}[/color][/url]`
			} else {
				ans = await converters.recurse(anchor, ctx)
			}

			return ans
		},
		blockquote: async (ele: HTMLQuoteElement, ctx: Context) => {
			const prefix = ''
			const suffix = ''
			const ans = `${prefix}${await converters.recurse(ele, ctx)}${suffix}`

			return ans
		},
		br: async () => {
			const ans = '\n'

			return ans
		},
		cite: async (ele: HTMLElement, ctx: Context) => {
			const prefix = '—— '
			const suffix = ''

			const ans = `${prefix}${await converters.recurse(ele, ctx)}${suffix}`

			return ans
		},
		code: async (ele: HTMLElement, ctx: Context) => {
			const prefix = "[backcolor=White][font=Monaco,Consolas,'Lucida Console','Courier New',serif]"
			const suffix = '[/font][/backcolor]'

			const ans = `${prefix}${await converters.recurse(ele, { ...ctx, disablePunctuationConverter: true })}${suffix}`

			return ans
		},
		div: async (ele: HTMLDivElement, ctx: Context) => {
			let ans = await converters.recurse(ele, ctx)

			if (ele.classList.contains('text-center')) {
				ans = `[/indent][/indent][align=center]${ans}[/align][indent][indent]\n`
			} else if (ele.classList.contains('article-image-carousel')) {
				// Image carousel.
				/* 
				 * <div> .article-image-carousel
				 *   <div> .slick-list
				 *     <div> .slick-track
				 *       * <div> .slick-slide [.slick-cloned]
				 *           <div>
				 *             <div> .slick-slide-carousel
				 *               <img> .article-image-carousel__image
				 *               <div> .article-image-carousel__caption
				 */
				const prefix = `[/indent][/indent][album]\n`
				const suffix = `\n[/album][indent][indent]\n`
				const slides: [string, string][] = []
				const findSlides = async (ele: HTMLDivElement | HTMLImageElement): Promise<void> => {
					if (ele.classList.contains('slick-cloned')) {
						return
					}
					if (ele.nodeName === 'IMG' && ele.classList.contains('article-image-carousel__image')) {
						slides.push([resolveUrl((ele as HTMLImageElement).src), ' '])
					} else if (ele.nodeName === 'DIV' && ele.classList.contains('article-image-carousel__caption')) {
						if (slides.length > 0) {
							slides[slides.length - 1][1] = `[b]${(await converters.recurse(ele, ctx))}[/b]`
						}
					} else {
						for (const child of Array.from(ele.childNodes)) {
							if (child.nodeName === 'DIV' || child.nodeName === 'IMG') {
								await findSlides(child as HTMLDivElement | HTMLImageElement)
							}
						}
					}
				}
				await findSlides(ele)
				if (shouldUseAlbum(slides)) {
					ans = `${prefix}${slides.map(([url, caption]) => `[aimg=${url}]${caption}[/aimg]`).join('\n')}${suffix}`
				} else if (slides.length > 0) {
					ans = `${slides.map(([url, caption]) => `[/indent][/indent][align=center][img]${url}[/img]\n${caption}`).join('\n')}[/align][indent][indent]\n`
				} else {
					ans = ''
				}
			} else if (ele.classList.contains('video')) {
				// Video.
				ans = '\n[/indent][/indent][align=center]【请将此处替换为含https的视频链接[media]XXX[/media]】[/align][indent][indent]\n'
			} else if (ele.classList.contains('quote') || ele.classList.contains('attributed-quote')) {
				ans = `\n[quote]\n${ans}\n[/quote]\n`
			} else if (ele.classList.contains('article-social')) {
				// End of the content.
				ans = ''
			} else if (ele.classList.contains('modal')) {
				// Unknown useless content
				ans = ''
			}
			// else if (ele.classList.contains('end-with-block')) {
			//     ans = ans.trimRight() + '[img=16,16]https://ooo.0o0.ooo/2017/01/30/588f60bbaaf78.png[/img]'
			// }

			return ans
		},
		dt: async () => {
			// const ans = `${converters.rescure(ele)}：`

			// return ans
			return ''
		},
		dl: async (ele: HTMLElement, ctx: Context) => {
			// The final <dd> after converted will contains an ending comma '，'
			// So I don't add any comma before '译者'.
			const ans = `\n\n${await converters.recurse(ele, ctx)}\n【本文排版借助了：[url=https://spx.spgoding.com][color=#388d40][u]SPX[/u][/color][/url]】\n\n`
			return ans
		},
		dd: async (ele: HTMLElement, ctx: Context) => {
			let ans = ''

			if (ele.classList.contains('pubDate')) {
				// Published:
				// `pubDate` is like '2019-03-08T10:00:00.876+0000'.
				const date = ele.attributes.getNamedItem('data-value')
				if (date) {
					ans = `[b]【${ctx.translator} 译自[url=${ctx.url}][color=#388d40][u]官网 ${date.value.slice(0, 4)} 年 ${date.value.slice(5, 7)} 月 ${date.value.slice(8, 10)} 日发布的 ${ctx.title}[/u][/color][/url]；原作者 ${ctx.author}】[/b]`
				} else {
					ans = `[b]【${ctx.translator} 译自[url=${ctx.url}][color=#388d40][u]官网 哪 年 哪 月 哪 日发布的 ${ctx.title}[/u][/color][/url]】[/b]`
				}
			} else {
				// Written by:
				ctx.author = await converters.recurse(ele, ctx)
			}

			return ans
		},
		em: async (ele: HTMLElement, ctx: Context) => {
			const ans = `[i]${await converters.recurse(ele, ctx)}[/i]`

			return ans
		},
		h1: async (ele: HTMLElement, ctx: Context) => {
			const prefix = '[size=6][b]'
			const suffix = '[/b][/size]'
			const inner = await converters.recurse(ele, ctx)
			const ans = `${prefix}[color=Silver]${inner.replace(/#388d40/g, 'Silver').replace(/[\n\r]+/g, ' ')}[/color]${suffix}\n${translateMachinely(`${prefix}${inner}${suffix}`, ctx).replace(/[\n\r]+/g, ' ')}\n\n`

			return ans
		},
		h2: async (ele: HTMLElement, ctx: Context) => {
			const prefix = '[size=5][b]'
			const suffix = '[/b][/size]'
			const inner = await converters.recurse(ele, ctx)
			const ans = `\n${prefix}[color=Silver]${inner.replace(/#388d40/g, 'Silver').replace(/[\n\r]+/g, ' ')}[/color]${suffix}\n${translateMachinely(`${prefix}${inner}${suffix}`, ctx).replace(/[\n\r]+/g, ' ')}\n\n`

			return ans
		},
		h3: async (ele: HTMLElement, ctx: Context) => {
			const prefix = '[size=4][b]'
			const suffix = '[/b][/size]'
			const inner = await converters.recurse(ele, ctx)
			const ans = `\n${prefix}[color=Silver]${inner.replace(/#388d40/g, 'Silver').replace(/[\n\r]+/g, ' ')}[/color]${suffix}\n${translateMachinely(`${prefix}${inner}${suffix}`, ctx).replace(/[\n\r]+/g, ' ')}\n\n`

			return ans
		},
		h4: async (ele: HTMLElement, ctx: Context) => {
			const prefix = '[size=3][b]'
			const suffix = '[/b][/size]'
			const inner = await converters.recurse(ele, ctx)
			const ans = `\n${prefix}[color=Silver]${inner.replace(/#388d40/g, 'Silver').replace(/[\n\r]+/g, ' ')}[/color]${suffix}\n${translateMachinely(`${prefix}${inner}${suffix}`, ctx).replace(/[\n\r]+/g, ' ')}\n\n`

			return ans
		},
		i: async (ele: HTMLElement, ctx: Context) => {
			const ans = `[i]${await converters.recurse(ele, ctx)}[/i]`

			return ans
		},
		img: async (img: HTMLImageElement) => {
			if (img.alt === 'Author image') {
				return ''
			}

			let w: number | undefined
			let h: number | undefined

			if (img.classList.contains('attributed-quote__image')) { // for in-quote avatar image
				h = 92
				w = 53
			} else if (img.classList.contains('mr-3')) { // for attributor avatar image
				h = 121
				w = 82
			}

			const prefix = w && h ? `[img=${w},${h}]` : '[img]'
			const imgUrl = resolveUrl(img.src)

			let ans: string
			if (img.classList.contains('attributed-quote__image') || img.classList.contains('mr-3')) {
				// Attributed quote author avatar.
				ans = `\n[float=left]${prefix}${imgUrl}[/img][/float]`
			} else {
				ans = `\n\n[/indent][/indent][align=center]${prefix}${imgUrl}[/img][/align][indent][indent]\n`
			}

			return ans
		},
		li: async (ele: HTMLElement, ctx: Context) => {
			const inner = await converters.recurse(ele, { ...ctx, inList: true })
			let ans: string
			if (ele.childNodes.length === 1 && (ele.childNodes[0].nodeName === 'OL' || ele.childNodes[0].nodeName === 'UL')) {
				// Nested lists.
				ans = `[*]${translateMachinely(translateBugs(inner, ctx), ctx)}\n`
			} else {
				ans = `[*][color=Silver]${inner.replace(/#388d40/g, 'Silver')}[/color]\n[*]${translateMachinely(translateBugs(inner, ctx), ctx)}\n`
			}

			return ans
		},
		ol: async (ele: HTMLElement, ctx: Context) => {
			const inner = await converters.recurse(ele, ctx)
			const ans = `[list=1]\n${inner}[/list]\n`

			return ans
		},
		p: async (ele: HTMLElement, ctx: Context) => {
			const inner = await converters.recurse(ele, ctx)

			let ans

			if (ele.classList.contains('lead')) {
				ans = `[size=4][b][size=2][color=Silver]${inner}[/color][/size][/b][/size]\n[size=4][b]${translateMachinely(inner, ctx)}[/b][/size]\n\n`
			} else {
				if (ctx.inList) {
					ans = inner
				} else {
					ans = `[size=2][color=Silver]${inner.replace(/#388d40/g, 'Silver')}[/color][/size]\n${translateMachinely(inner, ctx)}\n\n`
				}
			}

			return ans
		},
		picture: async (ele: HTMLElement, ctx: Context) => {
			const ans = await converters.recurse(ele, ctx)
			return ans
		},
		span: async (ele: HTMLElement, ctx: Context) => {
			const ans = await converters.recurse(ele, ctx)

			if (ele.classList.contains('bedrock-server')) {
				// Inline code.
				const prefix = "[backcolor=White][font=Monaco,Consolas,serif][color=#7824c5]"
				const suffix = '[/color][/font][/backcolor]'
				return `${prefix}${await converters.recurse(ele, { ...ctx, disablePunctuationConverter: true })}${suffix}`
			} else if (ele.classList.contains('strikethrough')) {
				// Strikethrough text.
				const prefix = '[s]'
				const suffix = '[/s]'
				return `${prefix}${ans}${suffix}`
			}

			return ans
		},
		strong: async (ele: HTMLElement, ctx: Context) => {
			const ans = `[b]${await converters.recurse(ele, ctx)}[/b]`

			return ans
		},
		table: async (ele: HTMLElement, ctx: Context) => {
			const ans = `\n[table]\n${await converters.recurse(ele, ctx)}[/table]\n`

			return ans
		},
		tbody: async (ele: HTMLElement, ctx: Context) => {
			const ans = await converters.recurse(ele, ctx)

			return ans
		},
		td: async (ele: HTMLElement, ctx: Context) => {
			const ans = `[td]${await converters.recurse(ele, ctx)}[/td]`

			return ans
		},
		tr: async (ele: HTMLElement, ctx: Context) => {
			const ans = `[tr]${await converters.recurse(ele, ctx)}[/tr]\n`

			return ans
		},
		ul: async (ele: HTMLElement, ctx: Context) => {
			const inner = await converters.recurse(ele, ctx)
			const ans = `[list]\n${inner}[/list]\n`

			return ans
		}
	}

	/**
	 * Replace all half-shape characters to full-shape characters.
	 */
	function translateMachinely(input: string, ctx: Context) {
		const mappings: [RegExp, string][] = [
			[/Block of the Week: /gi, '本周方块：'],
			[/Taking Inventory: /gi, '背包盘点：'],
			[/Around the Block: /gi, '群系漫游：'],
			[/A Minecraft Java Snapshot/gi, 'Minecraft Java版 快照'],
			[/A Minecraft Java Pre-Release/gi, 'Minecraft Java版 预发布版'],
			[/A Minecraft Java Release Candidate/gi, 'Minecraft Java版 候选版本'],
			[/Minecraft Beta (?:-|——) (.*?) \((.*?)\)/gi, 'Minecarft 基岩版 Beta $1（$2）'],
			[/Minecraft (?:-|——) (.*?) \(Bedrock\)/gi, 'Minecraft 基岩版 $1'],
			[/Minecraft (?:-|——) (.*?) \((.*?) Only\)/gi, 'Minecraft 基岩版 $1（仅$2）'],
			[/Minecraft (?:-|——) (.*?) \((.*?)\)/gi, 'Minecraft 基岩版 $1（仅$2）'],
			[/Caves & Cliffs Experimental Features/gi, '洞穴与山崖实验性特性'],
			[/Marketplace/gi, '市场'],
			[/Data-Driven/gi, '数据驱动'],
			[/Graphical/gi, '图像'],
			[/Player/gi, '玩家'],
			[/Experimental Features/gi, '实验性特性'],
			[/Mobs/gi, '生物'],
			[/Features and Bug Fixes/gi, '特性和漏洞修复'],
			[/Stability and Performance/gi, '稳定性和性能'],
			[/Accessibility/gi, '辅助功能'],
			[/Gameplay/gi, '玩法'],
			[/Items/gi, '物品'],
			[/Blocks/gi, '方块'],
			[/User Interface/gi, '用户界面'],
			[/Commands/gi, '命令'],
			[/Technical Updates/gi, '技术性更新'],
			[/Vanilla Parity/gi, '待同步特性'],
			[/Character Creator/gi, '角色创建器'],
			[/Minecraft Snapshot /gi, 'Minecraft 快照 '],
			[/Pre-Release /gi, '预发布版 '],
			[/Release Candidate /gi, '候选版本 '],
			[/Image credit:/gi, '图片来源：'],
			[/CC BY:/gi, '知识共享 署名'],
			[/CC BY-NC:/gi, '知识共享 署名-非商业性使用'],
			[/CC BY-ND:/gi, '知识共享 署名-禁止演绎'],
			[/CC BY-SA:/gi, '知识共享 署名-相同方式共享'],
			[/CC BY-NC-ND:/gi, '知识共享 署名-非商业性使用-禁止演绎'],
			[/CC BY-NC-SA:/gi, '知识共享 署名-非商业性使用-相同方式共享'],
			[/Public Domain:/gi, '公有领域'],
			[/The Caves & Cliffs Preview/gi, '洞穴与山崖预览数据包'], // to be deprecated
			[/\[size=6\]\[b\]New Features in ([^\r\n]+)\[\/b\]\[\/size\]/gi, '[size=6][b]$1 的新增特性[/b][/size]'],
			[/\[size=6\]\[b\]Changes in ([^\r\n]+)\[\/b\]\[\/size\]/gi, '[size=6][b]$1 的修改内容[/b][/size]'],
			[/\[size=6\]\[b\]Technical changes in ([^\r\n]+)\[\/b\]\[\/size\]/gi, '[size=6][b]$1 的技术性修改[/b][/size]'],
			[/\[size=6\]\[b\]Fixed bugs in ([^\r\n]+)\[\/b\]\[\/size\]/gi, '[size=6][b]$1 修复的漏洞[/b][/size]'],
			[/\[i\]/gi, '[font=楷体]'],
			[/\[\/i\]/g, '[/font]'],
			...ctx.disablePunctuationConverter ? [] : [
				[/,( |$)/g, '，'],
				[/!( |$)/g, '！'],
				[/\.\.\.( |$)/g, '…'],
				[/\.( |$)/g, '。'],
				[/\?( |$)/g, '？'],
				[/( |^)-( |$)/g, ' —— '],
			] as [RegExp, string][],
		]

		for (const mapping of mappings) {
			input = input.replace(mapping[0], mapping[1])
		}

		const quoteArrays: [string, string, RegExp][] = [
			['“', '”', /"/]
			// ['『', '』', "'"]
		]

		for (const quoteArray of quoteArrays) {
			const split = input.split(quoteArray[2])
			input = ''
			for (let i = 0; i < split.length - 1; i++) {
				const element = split[i]
				input += element + quoteArray[i % 2]
			}
			input += split[split.length - 1]
		}

		return input
	}

	/**
	 * Resolve relative URLs.
	 */
	function resolveUrl(url: string) {
		if (url[0] === '/') {
			return `https://www.minecraft.net${url}`
		} else {
			return url
		}
	}

	function removeLastLinebreak(str: string) {
		// if (str.slice(-1) === '\n') {
		//     return str.slice(0, -1)
		// }
		return str
	}

	function translateBugs(str: string, ctx: Context) {
		if (str.startsWith('[url=https://bugs.mojang.com/browse/MC-')) {
			const id = str.slice(36, str.indexOf(']'))
			const data = ctx.bugs[id]
			if (data) {
				const { summary, color } = data
				return `[url=https://bugs.mojang.com/browse/${id}][color=${color}][b]${id}[/b][/color][/url]- ${summary}`
			} else {
				return str
			}
		} else {
			return str
		}
	}

	function shouldUseAlbum(slides: [string, string][]) {
		const enableAlbum = true
		return enableAlbum
			? slides.length > 1
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			: slides.every(([_, caption]) => caption === ' ')
	}

	/**
	 * Returns the type of the article.
	 */
	function getArticleType(html: Document): string {
		try {
			const type = html.getElementsByClassName('article-category__text')?.[0]?.textContent ?? ''
			return type.toUpperCase()
		} catch (e) {
			console.error('[getArticleType]', e)
		}
		return 'INSIDER'
	}

	function getVersionType(url: string): VersionType {
		if (url.toLowerCase().includes('pre-release')) {
			return VersionType.PreRelease
		} else if (url.toLowerCase().includes('release-candidate')) {
			return VersionType.ReleaseCandidate
		} else if (url.toLowerCase().includes('snapshot')) {
			return VersionType.Snapshot
		} else if (url.toLowerCase().includes('minecraft java edition')) {
			return VersionType.Release
		} else {
			return VersionType.Normal
		}
	}

	function getBeginning(articleType: string, type: VersionType) {
		if (articleType.toLowerCase() !== 'news') {
			return ''
		}
		switch (type) {
			case VersionType.Snapshot:
				return `[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=48,48]https://attachment.mcbbs.net/data/myattachment/common/6c/common_45_icon.png[/img][/float][size=32px][b][color=#645944]每周快照[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][b]每周快照[/b]是 Minecraft Java 版的测试机制，用于新特性的展示和反馈收集。
[*][color=#8E2609]快照有可能导致存档损坏，因此请注意备份，不要直接在你的主存档游玩快照。[/color]
[*]转载本贴时须要注明原作者以及本帖地址。
[*]部分新特性译名仅供参考，不代表最终结果。
[/list][/size][/td][/tr]
[/table][/font][/align]

[hr]\n
【如果没有新方块物品等内容，请删去上方待定译名行。】\n`
			case VersionType.PreRelease:
				return `[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=48,48]https://attachment.mcbbs.net/data/myattachment/common/6c/common_45_icon.png[/img][/float][size=32px][b][color=#645944]预发布版[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][b]预发布版[/b]是 Minecraft Java 版的测试机制，主要是为了收集漏洞反馈，为正式发布做好准备。
[*][color=#8E2609]预发布版有可能导致存档损坏，因此请注意备份，不要直接在你的主存档游玩预发布版。[/color]
[*]转载本贴时须要注明原作者以及本帖地址。
[*]部分新特性译名仅供参考，不代表最终结果。
[/list][/size][/td][/tr]
[/table][/font][/align]

[hr]\n`
			case VersionType.ReleaseCandidate:
				return `[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=48,48]https://attachment.mcbbs.net/data/myattachment/common/6c/common_45_icon.png[/img][/float][size=32px][b][color=#645944]候选版本[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][b]候选版本[/b]是 Minecraft Java 版的测试机制。如果没有重大漏洞，该版本将会被用于正式发布。
[*][color=#8E2609]候选版本有可能导致存档损坏，因此请注意备份，不要直接在你的主存档游玩候选版本。[/color]
[*]转载本贴时须要注明原作者以及本帖地址。
[*]部分新特性译名仅供参考，不代表最终结果。
[/list][/size][/td][/tr]
[/table][/font][/align]

[hr]\n`
			case VersionType.Release:
				return `[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=46,48]https://ooo.0o0.ooo/2017/01/30/588f60bbaaf78.png[/img][/float][size=32px][b][color=#645944] Minecraft Java 版[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][b]Minecraft Java 版[/b]是指运行在 Windows、macOS 与 Linux 平台上，使用 Java 语言开发的 Minecraft 版本。
[*][b]正式版[/b]包含所有特性且安全稳定，所有玩家都可以尽情畅享。
[*]转载本贴时须要注明原作者以及本帖地址。
[/list][/size][/td][/tr]
[/table][/font][/align]

[hr]\n`

			case VersionType.BedrockRelease:
				return `[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=46,48]https://ooo.0o0.ooo/2017/01/30/588f60bbaaf78.png[/img][/float][size=32px][b][color=#645944]Minecraft 基岩版[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][b]Minecraft 基岩版[/b]是指运行在移动平台（Android、iOS）、Windows 10、主机（Xbox One、Switch、PlayStation 4）上，使用「基岩引擎」（C++语言）开发的 Minecraft 版本。
[*][b]正式版[/b]包含所有特性且安全稳定，所有玩家都可以尽情畅享。
[*]转载本贴时须要注明原作者以及本帖地址。
[/list][/size][/td][/tr]
[/table][/font][/align]

[hr]\n`

			case VersionType.BedrockBeta:
				return `[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=48,48]https://attachment.mcbbs.net/data/myattachment/common/6c/common_45_icon.png[/img][/float][size=32px][b][color=#645944]测试版[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][b]测试版[/b]是 Minecraft 基岩版的测试机制，主要用于下一个正式版的特性预览。
[*][color=#8E2609]测试版有可能导致存档损坏，因此请注意备份，不要直接在你的主存档游玩测试版。[/color]
[*]转载本贴时须要注明原作者以及本帖地址。
[*]部分新特性译名仅供参考，不代表最终结果。
[/list][/size][/td][/tr]
[/table][/font][/align]

[hr]\n`

			case VersionType.Normal:
			default:
				return `\n[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/3c/common_499_icon.png[/img][/float][size=24px][b][color=#645944] 转载须知[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*]转载本贴时须要注明原作者以及本帖地址。
[/list][/size][/td][/tr]
[/table][/font][/align]
[hr]\n`

		}
	}

	function getEnding(articleType: string, type: VersionType) {
		if (articleType.toLowerCase() !== 'news') {
			return ''
		}
		switch (type) {
			case VersionType.Snapshot:
				return `\n[*][url=https://www.minecraft.net/zh-hans/download/][color=Sienna]正版启动器下载地址[/color][/url]
[*][url=https://bugs.mojang.com/browse/MC][color=Sienna]漏洞报告站点（仅限英文）[/color][/url]
[*][url=https://aka.ms/CavesCliffsFeedback?ref=minecraftnet][color=Sienna]官方反馈网站（仅限英文，适用于洞穴与山崖更新）[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=40,32]https://attachment.mcbbs.net/data/myattachment/common/d6/common_39_icon.png[/img][/float][size=24px][b][color=#645944] 如何游玩快照？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*]对于正版用户：请打开官方启动器，在「配置」选项卡中启用「快照」，选择「最新快照」即可。
[*]对于非正版用户：请于[url=http://www.mcbbs.net/forum.php?mod=viewthread&tid=38297&page=1#pid547821][color=Sienna]推荐启动器列表[/color][/url]寻找合适的启动器。目前绝大多数主流启动器都带有下载功能。如仍有疑惑请到[url=http://www.mcbbs.net/forum-qanda-1.html][color=Sienna]原版问答[/color][/url]板块提问。
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/e0/common_139_icon.png[/img][/float][size=24px][b][color=#645944] 想了解更多新闻资讯？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][url=https://www.mcbbs.net/thread-874677-1-1.html][color=Sienna]外部来源以及详细的更新条目追踪[/color][/url]
[*][url=https://www.mcbbs.net/forum.php?mod=forumdisplay&fid=139][color=Sienna]我的世界中文论坛 - 新闻资讯板块[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]`

			case VersionType.PreRelease:
				return `\n[*][url=https://www.minecraft.net/zh-hans/download/][color=Sienna]正版启动器下载地址[/color][/url]
[*][url=https://bugs.mojang.com/browse/MC][color=Sienna]漏洞报告站点（仅限英文）[/color][/url]
[*][url=https://aka.ms/CavesCliffsFeedback?ref=minecraftnet][color=Sienna]官方反馈网站（仅限英文，适用于洞穴与山崖更新）[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=40,32]https://attachment.mcbbs.net/data/myattachment/common/d6/common_39_icon.png[/img][/float][size=24px][b][color=#645944] 如何游玩预发布版？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*]对于正版用户：请打开官方启动器，在「配置」选项卡中启用「快照」，选择「最新快照」即可。
[*]对于非正版用户：请于[url=http://www.mcbbs.net/forum.php?mod=viewthread&tid=38297&page=1#pid547821][color=Sienna]推荐启动器列表[/color][/url]寻找合适的启动器。目前绝大多数主流启动器都带有下载功能。如仍有疑惑请到[url=http://www.mcbbs.net/forum-qanda-1.html][color=Sienna]原版问答[/color][/url]板块提问。
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/e0/common_139_icon.png[/img][/float][size=24px][b][color=#645944] 想了解更多新闻资讯？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][url=https://www.mcbbs.net/thread-874677-1-1.html][color=Sienna]外部来源以及详细的更新条目追踪[/color][/url]
[*][url=https://www.mcbbs.net/forum.php?mod=forumdisplay&fid=139][color=Sienna]我的世界中文论坛 - 新闻资讯板块[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]`

			case VersionType.ReleaseCandidate:
				return `\n[*][url=https://www.minecraft.net/zh-hans/download/][color=Sienna]正版启动器下载地址[/color][/url]
[*][url=https://bugs.mojang.com/browse/MC][color=Sienna]漏洞报告站点（仅限英文）[/color][/url]
[*][url=https://aka.ms/CavesCliffsFeedback?ref=minecraftnet][color=Sienna]官方反馈网站（仅限英文，适用于洞穴与山崖更新）[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=40,32]https://attachment.mcbbs.net/data/myattachment/common/d6/common_39_icon.png[/img][/float][size=24px][b][color=#645944] 如何游玩候选版本？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*]对于正版用户：请打开官方启动器，在「配置」选项卡中启用「快照」，选择「最新快照」即可。
[*]对于非正版用户：请于[url=http://www.mcbbs.net/forum.php?mod=viewthread&tid=38297&page=1#pid547821][color=Sienna]推荐启动器列表[/color][/url]寻找合适的启动器。目前绝大多数主流启动器都带有下载功能。如仍有疑惑请到[url=http://www.mcbbs.net/forum-qanda-1.html][color=Sienna]原版问答[/color][/url]板块提问。
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/e0/common_139_icon.png[/img][/float][size=24px][b][color=#645944] 想了解更多新闻资讯？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][url=https://www.mcbbs.net/thread-874677-1-1.html][color=Sienna]外部来源以及详细的更新条目追踪[/color][/url]
[*][url=https://www.mcbbs.net/forum.php?mod=forumdisplay&fid=139][color=Sienna]我的世界中文论坛 - 新闻资讯板块[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]`

			case VersionType.Release:
				return `\n[*][url=https://www.minecraft.net/zh-hans/download/][color=Sienna]正版启动器下载地址[/color][/url]
[*][url=https://bugs.mojang.com/browse/MC][color=Sienna]漏洞报告站点（仅限英文）[/color][/url]
[*][url=https://aka.ms/CavesCliffsFeedback?ref=minecraftnet][color=Sienna]官方反馈网站（仅限英文，适用于洞穴与山崖更新）[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=40,32]https://attachment.mcbbs.net/data/myattachment/common/d6/common_39_icon.png[/img][/float][size=24px][b][color=#645944] 如何游玩正式版？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*]对于正版用户：请打开官方启动器，选择「最新版本」即可。
[*]对于非正版用户：请于[url=http://www.mcbbs.net/forum.php?mod=viewthread&tid=38297&page=1#pid547821][color=Sienna]推荐启动器列表[/color][/url]寻找合适的启动器。目前绝大多数主流启动器都带有下载功能。如仍有疑惑请到[url=http://www.mcbbs.net/forum-qanda-1.html][color=Sienna]原版问答[/color][/url]板块提问。
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/e0/common_139_icon.png[/img][/float][size=24px][b][color=#645944] 想了解更多新闻资讯？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][url=https://www.mcbbs.net/thread-874677-1-1.html][color=Sienna]外部来源以及详细的更新条目追踪[/color][/url]
[*][url=https://www.mcbbs.net/forum.php?mod=forumdisplay&fid=139][color=Sienna]我的世界中文论坛 - 新闻资讯板块[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]`

			case VersionType.BedrockRelease:
				return `\n[hr]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/39/common_137_icon.png[/img][/float][size=24px][b][color=#645944] 实用链接[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][url=https://bugs.mojang.com/browse/MCPE][color=Sienna]漏洞报告站点（仅限英文）[/color][/url]
[*][url=https://aka.ms/CavesCliffsFeedback?ref=minecraftnet][color=Sienna]官方反馈网站（仅限英文，适用于洞穴与山崖更新）[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=40,32]https://attachment.mcbbs.net/data/myattachment/common/d6/common_39_icon.png[/img][/float][size=24px][b][color=#645944] 如何游玩测试版？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*]请访问[url=https://www.minecraft.net/zh-hans/get-minecraft][color=Sienna]官方游戏获取地址[/color][/url]，根据您所使用的平台获取游戏。
[*]在新建/编辑地图时，请滑动到「实验性游戏内容（Experiments）」，打开 "Caves & Cliffs" 即可体验洞穴与山崖更新的最新内容。
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/e0/common_139_icon.png[/img][/float][size=24px][b][color=#645944] 想了解更多新闻资讯？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][url=https://www.mcbbs.net/thread-874677-1-1.html][color=Sienna]外部来源以及详细的更新条目追踪[/color][/url]
[*][url=https://www.mcbbs.net/forum.php?mod=forumdisplay&fid=139][color=Sienna]我的世界中文论坛 - 新闻资讯板块[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]`

			case VersionType.BedrockBeta:
				return `\n[hr]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/39/common_137_icon.png[/img][/float][size=24px][b][color=#645944] 实用链接[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][url=https://bugs.mojang.com/browse/MCPE][color=Sienna]漏洞报告站点（仅限英文）[/color][/url]
[*][url=https://aka.ms/CavesCliffsFeedback?ref=minecraftnet][color=Sienna]官方反馈网站（仅限英文，适用于洞穴与山崖更新）[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=40,32]https://attachment.mcbbs.net/data/myattachment/common/d6/common_39_icon.png[/img][/float][size=24px][b][color=#645944] 如何游玩测试版？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*]请访问[url=https://www.minecraft.net/zh-hans/get-minecraft][color=Sienna]官方游戏获取地址[/color][/url]，根据您所使用的平台获取游戏。
[*]基岩测试版仅限于 Windows 10、Android、Xbox One 平台。请根据[url=https://www.mcbbs.net/thread-1183093-1-1.html][color=Sienna]官方指引[/color][/url]启用/关闭测试版。
[*]在新建/编辑地图时，请滑动到「实验性游戏内容（Experiments）」，打开 "Caves & Cliffs" 即可体验洞穴与山崖更新的最新内容。
[/list][/size][/td][/tr]
[/table][/font][/align]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/e0/common_139_icon.png[/img][/float][size=24px][b][color=#645944] 想了解更多新闻资讯？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][url=https://www.mcbbs.net/thread-874677-1-1.html][color=Sienna]外部来源以及详细的更新条目追踪[/color][/url]
[*][url=https://www.mcbbs.net/forum.php?mod=forumdisplay&fid=139][color=Sienna]我的世界中文论坛 - 新闻资讯板块[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]`

			case VersionType.Normal:
			default:
				return `\n[hr]
[align=center][font=-apple-system, BlinkMacSystemFont,Segoe UI, Roboto, Helvetica, Arial, sans-serif][table=85%]
[tr=#E3C99E][td][float=left][img=32,32]https://attachment.mcbbs.net/data/myattachment/common/e0/common_139_icon.png[/img][/float][size=24px][b][color=#645944] 想了解更多新闻资讯？[/color][/b][/size][/td][/tr]
[tr=#FDF6E5][td][size=16px][list]
[*][url=https://www.mcbbs.net/thread-874677-1-1.html][color=Sienna]外部来源以及详细的更新条目追踪[/color][/url]
[*][url=https://www.mcbbs.net/forum.php?mod=forumdisplay&fid=139][color=Sienna]我的世界中文论坛 - 新闻资讯板块[/color][/url]
[/list][/size][/td][/tr]
[/table][/font][/align]`
		}
	}

	const enum VersionType {
		Snapshot,
		PreRelease,
		ReleaseCandidate,
		Release,
		Normal,
		BedrockBeta,
		BedrockRelease
	}

	// Minecraft.net END
	// Twitter START

	const ProfilePictures = new Map<string, string>([
    ['Mojang', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124525b5b85bb8ob8t8o0b.jpg'],
    ['MojangSupport', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124525b5b85bb8ob8t8o0b.jpg'],
    ['MojangStatus', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124525b5b85bb8ob8t8o0b.jpg'],
    ['Minecraft', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124524kfu7hzreleueuexh.jpg'],
    ['henrikkniberg', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124519x0r898zl6gc8gna8.jpg'],
    ['_LadyAgnes', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124515qnwcdnz82vyz9ezs.png'],
    ['kingbdogz', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124523da4of54hl7e3fchn.jpg'],
    ['JasperBoerstra', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124522uk3hbr2gx62pbrfh.jpg'],
    ['adrian_ivl', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124513jppdcsu8lsxllxll.jpg'],
    ['slicedlime', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124528na53pu1444w1pdys.jpg'],
    ['Cojomax99', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124516jgwgrzgerr11g9kn.png'],
    ['Mojang_Ined', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124520dpqpa0fufu0fq0l1.jpg'],
    ['SeargeDP', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124527syfrwsstbvxf8jf0.png'],
    ['Dinnerbone', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/18/124517k1n33zuxaumkakam.jpg'],
    ['Marc_IRL', 'https://attachment.mcbbs.net/data/myattachment/forum/202105/28/104919xl2ac5dihxlqxxdf.jpg'],
    ['Mega_Spud', 'https://attachment.mcbbs.net/data/myattachment/forum/202107/07/230046homkfqlhwvkfqkbh.jpg'],
	])

	function getTweetMetadata(): Tweet {
		const tweetMetadata: Tweet = {
			date: '',
			source: '',
			text: '',
			tweetLink: '',
			urls: '',
			userName: '',
			userTag: '',
			lang: '',
		}
		tweetMetadata.userTag = document.querySelector('div[data-testid=tweet] > div:nth-child(2) a div:nth-child(2) span')!.innerHTML.replace('@', '')
		tweetMetadata.userName = document.querySelector('div[data-testid=tweet] > div:nth-child(2) a span span')!.innerHTML
		tweetMetadata.lang = document.querySelector('article div[lang]')!.getAttribute('lang')!

		const texts: string[] = []
		for (const i of document.querySelector('article div[lang]')!.querySelectorAll('span')!) {
			texts.push(i.innerHTML)
		}
		tweetMetadata.text = texts.join('【这里可能有一个链接，请自行检查】')
		tweetMetadata.date = document.querySelector('article div:nth-child(3) div:nth-child(3) div span')!.innerHTML
		tweetMetadata.source = document.querySelector('article div:nth-child(3) div:nth-child(3) a:nth-child(3) span')!.innerHTML
		tweetMetadata.tweetLink = location.href

		return tweetMetadata
	}

	function getTweetBbcode(
    tweet: Tweet,
		mode: 'dark' | 'light') {
    const attributeColor = '#5B7083'
    const backgroundColor = mode === 'dark' ? '#000000' : '#FFFFFF'
    const foregroundColor = mode === 'dark' ? '#D9D9D9' : '#0F1419'
    const dateString = `${tweet.date} · ${tweet.source} · SPX`
    const content = tweet.text
    return `[align=center][table=560,${backgroundColor}]
[tr][td][font=-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif][indent]
[float=left][img=44,44]${ProfilePictures.get(tweet.userTag) ?? '【TODO：头像】'}[/img][/float][size=15px][b][color=${foregroundColor}]${tweet.userName}[/color][/b]
[color=${attributeColor}]@${tweet.userTag}[/color][/size]

[color=${foregroundColor}][size=23px]${content}[/size]
[size=15px]由 【请填写你的用户名】 翻译自${tweet.lang.startsWith('en') ? '英语' : ` ${tweet.lang}`}[/size]
[size=23px]【插入：译文】[/size][/color][/indent][align=center][img=451,254]【TODO：配图】[/img][/align][indent][size=15px][url=${tweet.tweetLink}][color=${attributeColor}]${dateString}[/color][/url][/size][/indent][/font]
[/td][/tr]
[/table][/align]`
	}

	function twitter() {
		console.info('[SPX] Activated')

		const buttonLight = document.createElement('button')
		buttonLight.innerText = 'Copy BBCode (Light)'
		buttonLight.style.width = '100%'
		buttonLight.onclick = async () => {
			buttonLight.innerText = 'Processing...'
			const bbcode = getTweetBbcode(getTweetMetadata(), 'light')
			GM_setClipboard(bbcode, { type: 'text', mimetype: 'text/plain' })
			buttonLight.innerText = 'Copied BBCode!'
			setTimeout(() => buttonLight.innerText = 'Copy BBCode', 5_000)
		}

		const buttonDark = document.createElement('button')
		buttonDark.innerText = 'Copy BBCode (Dark)'
		buttonDark.style.width = '100%'
		buttonDark.onclick = async () => {
			buttonDark.innerText = 'Processing...'
			const bbcode = getTweetBbcode(getTweetMetadata(), 'dark')
			GM_setClipboard(bbcode, { type: 'text', mimetype: 'text/plain' })
			buttonDark.innerText = 'Copied BBCode!'
			setTimeout(() => buttonDark.innerText = 'Copy BBCode', 5_000)
		}

		const checkLoaded = setInterval(() => {
			if (document.querySelector('article div[lang]')! !== null) {
				document.querySelector('article div > div > div > div')!.append(buttonLight)
				document.querySelector('article div > div > div > div')!.append(buttonDark)
				clearInterval(checkLoaded)
			}
		}, 300)
	}

	console.log('[SPX] Current site: ' + location.host)
	switch (location.host) {
		case 'www.minecraft.net':
			minecraftNet()
		break
		case 'twitter.com':
		case 'moble.twitter.com':
			twitter()
		break
		case 'feedback.minecraft.net':
			feedback()
		break
		case 'help.minecraft.net':
			help()
	}
})()
