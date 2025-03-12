const axios = require("axios")
const cheerio = require("cheerio")

// Configuration
const BASE_URL = "https://komikindo2.com"
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0"

/**
 * Function to fetch HTML using axios
 *
 * @param {string} url URL to fetch
 * @returns {Promise<string>} HTML content
 */
async function fetchHTML(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      timeout: 30000,
    })
    return response.data
  } catch (error) {
    throw new Error(`Error fetching HTML: ${error.message}`)
  }
}

/**
 * Function to convert URL to path
 *
 * @param {string} url Full URL
 * @returns {string} Path from URL
 */
function getPathFromUrl(url) {
  if (!url) return ""
  if (url.startsWith(BASE_URL)) {
    const parsedUrl = new URL(url)
    return parsedUrl.pathname
  }
  return url
}

/**
 * Function to clean text
 *
 * @param {string} text Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return ""
  return text.replace(/\s+/g, " ").trim()
}

/**
 * Get latest manga
 *
 * @param {number} page Page number
 * @returns {Promise<object>} Latest manga data
 */
async function getLatestKomik(page = 1) {
  const url = `${BASE_URL}/komik-terbaru/page/${page}`

  try {
    const htmlContent = await fetchHTML(url)
    const $ = cheerio.load(htmlContent)

    const results = []
    const komikPopuler = []

    // Get animepost data
    $(".animepost").each((i, el) => {
      const title = $(el).find(".tt h4").text().trim() || "Tidak ada judul"
      const link = getPathFromUrl($(el).find('a[rel="bookmark"]').attr("href") || "")
      const image = $(el).find('img[itemprop="image"]').attr("src") || ""
      const typeClass = $(el).find(".typeflag").attr("class") || "Tidak ada tipe"
      const type = typeClass.split(" ").pop() || "Tidak ada tipe"
      const color = $(el).find(".warnalabel").text().trim() || "Hitam"

      const chapter = []
      $(el)
        .find(".lsch")
        .each((j, chEl) => {
          const chTitle = $(chEl).find("a").text().trim().replace("Ch.", "Chapter") || "Chapter tanpa judul"
          const chLink = getPathFromUrl($(chEl).find("a").attr("href") || "")
          const chDate = $(chEl).find(".datech").text().trim() || "Tidak ada tanggal"
          chapter.push({
            judul: chTitle,
            link: chLink,
            tanggal_rilis: chDate,
          })
        })

      results.push({
        judul: title,
        link: link,
        gambar: image,
        tipe: type,
        warna: color,
        chapter: chapter,
      })
    })

    // Get popular manga
    $(".serieslist.pop li").each((i, el) => {
      const rank = $(el).find(".ctr").text().trim() || "Tidak ada peringkat"
      const title = $(el).find("h4 a").text().trim() || "Tidak ada judul"
      const link = getPathFromUrl($(el).find("h4 a").attr("href") || "")
      const image = $(el).find(".imgseries img").attr("src") || ""
      const author = $(el).find(".author").text().trim() || "Penulis tidak diketahui"
      const ratingText = $(el).find(".loveviews").text().trim() || "Tidak ada rating"
      const rating = ratingText.split(" ").pop() || "Tidak ada rating"

      komikPopuler.push({
        peringkat: rank,
        judul: title,
        link: link,
        penulis: author,
        rating: rating,
        gambar: image,
      })
    })

    // Get total pages from pagination
    const pagination = $(".pagination a.page-numbers")
    const totalPages =
      pagination.length > 1
        ? Number.parseInt(
            $(pagination[pagination.length - 2])
              .text()
              .trim(),
          ) || 1
        : 1

    return {
      total_halaman: totalPages,
      komik: results,
      komik_populer: komikPopuler,
    }
  } catch (error) {
    throw error
  }
}

/**
 * Get manga detail
 *
 * @param {string} komikId Manga ID
 * @returns {Promise<object>} Manga detail
 */
async function getKomikDetail(komikId) {
  const url = `${BASE_URL}/komik/${komikId}`

  try {
    const htmlContent = await fetchHTML(url)
    const $ = cheerio.load(htmlContent)

    const title = $("h1.entry-title").text().trim() || "Tidak ada judul"
    const description =
      cleanText($('.entry-content.entry-content-single[itemprop="description"] p').text()) || "Tidak ada desk"

    const detail = {
      judul_alternatif: null,
      status: null,
      pengarang: null,
      ilustrator: null,
      jenis_komik: null,
      tema: null,
    }

    $(".spe span").each((i, el) => {
      const key = $(el).find("b").text().trim()
      let value = cleanText($(el).text().replace(`${key}:`, ""))
      const cleanKey = key.replace(":", "").trim()
      value = value.replace(`${cleanKey}:`, "").trim()

      switch (cleanKey.toLowerCase()) {
        case "judul alternatif":
          detail.judul_alternatif = value
          break
        case "status":
          detail.status = value
          break
        case "pengarang":
          detail.pengarang = value
          break
        case "ilustrator":
          detail.ilustrator = value
          break
        case "tema":
          detail.tema = value
          break
        case "jenis komik":
          detail.jenis_komik = value
          break
      }
    })

    const image = $(".thumb img").attr("src") || ""
    const rating = $('i[itemprop="ratingValue"]').text().trim() || "Tidak ada rating"
    const votes = $(".votescount").text().trim() || "Tidak ada votes"

    const chapters = []
    $(".listeps ul li").each((i, el) => {
      const chapterTitle = $(el).find(".lchx a").text().trim() || "Tidak ada judul"
      const chapterLink = getPathFromUrl($(el).find(".lchx a").attr("href") || "")
      const releaseTime = $(el).find(".dt a").text().trim() || "Tidak ada waktu rilis"
      chapters.push({
        judul_chapter: chapterTitle,
        link_chapter: chapterLink,
        waktu_rilis: releaseTime,
      })
    })

    let chapterAwal = null
    let chapterTerbaru = null
    const epsbrDivs = $(".epsbr")

    if (epsbrDivs.length >= 2) {
      chapterAwal = {
        judul_chapter: $(epsbrDivs[0]).find("a").text().trim() || "Tidak ada judul",
        link_chapter: getPathFromUrl($(epsbrDivs[0]).find("a").attr("href") || ""),
      }

      chapterTerbaru = {
        judul_chapter: $(epsbrDivs[1]).find("a").text().trim() || "Tidak ada judul",
        link_chapter: getPathFromUrl($(epsbrDivs[1]).find("a").attr("href") || ""),
      }
    }

    const similarManga = []
    $(".serieslist ul li").each((i, el) => {
      similarManga.push({
        judul: $(el).find(".leftseries h4 a").text().trim() || "Tidak ada judul",
        link: getPathFromUrl($(el).find(".leftseries h4 a").attr("href") || ""),
        gambar: $(el).find(".imgseries a img").attr("src") || "",
        desk: $(el).find(".excerptmirip").text().trim() || "Tidak ada desk",
      })
    })

    const spoilerImage = []
    $("#spoiler .spoiler-img img").each((i, el) => {
      spoilerImage.push($(el).attr("src") || "")
    })

    const id = $("article").attr("id")?.replace("post-", "") || "Tidak ada ID"

    const genre = []
    $(".genre-info a").each((i, el) => {
      genre.push({
        nama: $(el).text().trim() || "Tidak ada genre",
        link: getPathFromUrl($(el).attr("href") || "").replace("/genres/", ""),
      })
    })

    return {
      id: id,
      judul: title,
      gambar: image,
      rating: rating,
      votes: votes,
      detail: detail,
      genre: genre,
      desk: description,
      chapter_awal: chapterAwal,
      chapter_terbaru: chapterTerbaru,
      daftar_chapter: chapters,
      chapter_spoiler: spoilerImage,
      komik_serupa: similarManga,
    }
  } catch (error) {
    throw error
  }
}

/**
 * Get manga chapter
 *
 * @param {string} chapterId Chapter ID
 * @returns {Promise<object>} Chapter data
 */
async function getKomikChapter(chapterId) {
  const url = `${BASE_URL}/${chapterId}`

  try {
    const htmlContent = await fetchHTML(url)
    const $ = cheerio.load(htmlContent)

    const results = {}
    results.id = $("article").attr("id")?.replace("post-", "") || "Tidak ada ID"
    results.judul = $(".entry-title").text().trim() || "Tidak ada judul"
    results.navigasi = {
      sebelumnya: getPathFromUrl($('a[rel="prev"]').attr("href") || ""),
      selanjutnya: getPathFromUrl($('a[rel="next"]').attr("href") || ""),
    }

    const allchElement = $("a div.icol.daftarch")
    results.semua_chapter = allchElement.length ? getPathFromUrl(allchElement.parent().attr("href")) : null

    results.gambar = []
    $(".chapter-image img").each((index, el) => {
      const imgSrc = $(el).attr("src")
      if (imgSrc) {
        results.gambar.push({
          id: index + 1,
          url: imgSrc,
        })
      }
    })

    const thumbnail = $("div.thumb img")
    results.thumbnail = thumbnail.length
      ? {
          url: thumbnail.attr("src"),
          judul: thumbnail.attr("title") || "Tidak ada judul",
        }
      : null

    results.info_komik = {
      judul: $(".infox h2").text().trim() || "Tidak ada judul",
      desk: $(".shortcsc").text().trim() || "Tidak ada desk",
      chapter: [],
    }

    $("#chapter_list .lchx a").each((i, el) => {
      results.info_komik.chapter.push({
        judul_chapter: $(el).text().trim(),
        link_chapter: getPathFromUrl($(el).attr("href")),
      })
    })

    return results
  } catch (error) {
    throw error
  }
}

/**
 * Get manga library
 *
 * @param {object} params Search parameters
 * @returns {Promise<object>} Manga library
 */
async function getKomikLibrary(params) {
  let url = ""

  if (params.genre) {
    const genre = params.genre
    const page = params.page || 1
    url = `${BASE_URL}/daftar-manga/page/${page}/?genre%5B0%5D=${encodeURIComponent(genre)}&status&type&format&order&title`
  } else if (params.page && params.s) {
    const page = params.page
    const search = params.s
    url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(search)}`
  } else if (params.page && params.type) {
    const page = params.page
    const type = params.type
    url = `${BASE_URL}/daftar-manga/page/${page}/?status&type=${type}&format&order&title`
  } else if (params.daftar) {
    const daftar = params.daftar
    url = daftar == 1 ? `${BASE_URL}/daftar-manga/` : `${BASE_URL}/daftar-manga/page/${daftar}/`
  } else {
    url = `${BASE_URL}/daftar-manga`
  }

  try {
    const htmlContent = await fetchHTML(url)
    const $ = cheerio.load(htmlContent)

    const results = []
    const komikPopuler = []

    // Get manga based on genre or category
    $(".animepost").each((i, el) => {
      const title = $(el).find(".tt h4").text().trim() || "Tidak ada judul"
      const rating = $(el).find(".rating i").text().trim() || "0"
      const link = $(el).find('a[rel="bookmark"]').attr("href") || ""
      const image = $(el).find('img[itemprop="image"]').attr("src") || ""
      const typeClass = $(el).find(".typeflag").attr("class")
      const type = typeClass ? typeClass.split(" ").pop() : "Tidak ada tipe"
      const color = $(el).find(".warnalabel").text().trim() || "Hitam"

      results.push({
        judul: title,
        rating: rating,
        link: getPathFromUrl(link),
        gambar: image,
        tipe: type,
        warna: color,
      })
    })

    // Get popular manga
    $(".serieslist.pop li").each((i, el) => {
      const rank = $(el).find(".ctr").text().trim() || "Tidak ada peringkat"
      const title = $(el).find("h4 a").text().trim() || "Tidak ada judul"
      const link = $(el).find("h4 a").attr("href") || ""
      const image = $(el).find(".imgseries img").attr("src") || ""
      const author = $(el).find(".author").text().trim() || "Penulis tidak diketahui"
      const ratingText = $(el).find(".loveviews").text().trim() || ""
      const rating = ratingText ? ratingText.split(" ").pop() : "Tidak ada rating"

      komikPopuler.push({
        judul: title,
        link: getPathFromUrl(link),
        peringkat: rank,
        penulis: author,
        rating: rating,
        gambar: image,
      })
    })

    // Determine total pages for pagination
    const pagination = $(".pagination a.page-numbers").last().prev()
    const totalPages = pagination.length ? Number.parseInt(pagination.text().trim()) : 1

    return {
      total_halaman: totalPages,
      komik: results,
      komik_populer: komikPopuler,
    }
  } catch (error) {
    throw error
  }
}

module.exports = {
  getLatestKomik,
  getKomikDetail,
  getKomikChapter,
  getKomikLibrary,
}

