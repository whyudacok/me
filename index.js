/**
 * CuymangaAPI
 *
 * Version: 1.1.0
 * Author: whyudacok (Node.js port by v0)
 * License: MIT
 * 
 * A manga scraper API for komikindo2.com
 */

import express from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';

// Configuration
const BASE_URL = 'https://komikindo2.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0';
const RATE_LIMIT = 60; // Requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // Window in milliseconds

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('X-Content-Type-Options', 'nosniff');
  next();
});

// Apply rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: false,
    message: 'Rate limit exceeded. Please try again later.',
    data: null
  }
});

app.use(limiter);

/**
 * Fetch HTML content from URL
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} - HTML content
 */
async function fetchHTML(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      },
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    throw new Error(`Error fetching URL: ${error.message}`);
  }
}

/**
 * Get path from URL
 * @param {string} url - Full URL
 * @returns {string} - Path from URL
 */
function getPathFromUrl(url) {
  if (!url) return '';
  if (url.startsWith(BASE_URL)) {
    return new URL(url).pathname;
  }
  return url;
}

/**
 * Clean text by removing extra whitespace
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Get latest manga
 * @param {number} page - Page number
 * @returns {Promise<object>} - Latest manga data
 */
async function getLatestKomik(page = 1) {
  const url = `${BASE_URL}/komik-terbaru/page/${page}`;

  try {
    const htmlContent = await fetchHTML(url);
    const $ = cheerio.load(htmlContent);
    
    const results = [];
    const komikPopuler = [];

    // Get animepost data
    $('.animepost').each((i, el) => {
      const title = $(el).find('.tt h4').text().trim() || 'Tidak ada judul';
      const link = getPathFromUrl($(el).find('a[rel="bookmark"]').attr('href') || '');
      const image = $(el).find('img[itemprop="image"]').attr('src') || '';
      const typeClass = $(el).find('.typeflag').attr('class') || 'Tidak ada tipe';
      const type = typeClass.split(' ').pop();
      const color = $(el).find('.warnalabel').text().trim() || 'Hitam';

      const chapter = [];
      $(el).find('.lsch').each((j, chEl) => {
        const chTitle = $(chEl).find('a').text().replace('Ch.', 'Chapter').trim() || 'Chapter tanpa judul';
        const chLink = getPathFromUrl($(chEl).find('a').attr('href') || '');
        const chDate = $(chEl).find('.datech').text().trim() || 'Tidak ada tanggal';
        chapter.push({
          judul: chTitle,
          link: chLink,
          tanggal_rilis: chDate
        });
      });

      results.push({
        judul: title,
        link: link,
        gambar: image,
        tipe: type,
        warna: color,
        chapter: chapter
      });
    });

    // Get popular manga
    $('.serieslist.pop li').each((i, el) => {
      const rank = $(el).find('.ctr').text().trim() || 'Tidak ada peringkat';
      const title = $(el).find('h4 a').text().trim() || 'Tidak ada judul';
      const link = getPathFromUrl($(el).find('h4 a').attr('href') || '');
      const image = $(el).find('.imgseries img').attr('src') || '';
      const author = $(el).find('.author').text().trim() || 'Penulis tidak diketahui';
      
      const loveviewsText = $(el).find('.loveviews').text().trim() || 'Tidak ada rating';
      const rating = loveviewsText.split(' ').pop();

      komikPopuler.push({
        peringkat: rank,
        judul: title,
        link: link,
        penulis: author,
        rating: rating,
        gambar: image
      });
    });

    // Get total pages from pagination
    const pagination = $('.pagination a.page-numbers');
    const totalPages = pagination.length > 1 
      ? parseInt($(pagination[pagination.length - 2]).text().trim()) || 1 
      : 1;

    return {
      total_halaman: totalPages,
      komik: results,
      komik_populer: komikPopuler
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get manga details
 * @param {string} komikId - Manga ID
 * @returns {Promise<object>} - Manga details
 */
async function getKomikDetail(komikId) {
  const url = `${BASE_URL}/komik/${komikId}`;

  try {
    const htmlContent = await fetchHTML(url);
    const $ = cheerio.load(htmlContent);

    const title = $('.entry-title').text().trim() || 'Tidak ada judul';
    const description = cleanText($('.entry-content.entry-content-single[itemprop="description"] p').text() || 'Tidak ada desk');

    const detail = {
      judul_alternatif: null,
      status: null,
      pengarang: null,
      ilustrator: null,
      jenis_komik: null,
      tema: null
    };

    $('.spe span').each((i, el) => {
      const key = $(el).find('b').text().trim().replace(':', '');
      let value = $(el).text().replace(`${key}:`, '').trim();
      
      switch (key.toLowerCase()) {
        case 'judul alternatif':
          detail.judul_alternatif = value;
          break;
        case 'status':
          detail.status = value;
          break;
        case 'pengarang':
          detail.pengarang = value;
          break;
        case 'ilustrator':
          detail.ilustrator = value;
          break;
        case 'tema':
          detail.tema = value;
          break;
        case 'jenis komik':
          detail.jenis_komik = value;
          break;
      }
    });

    const image = $('.thumb img').attr('src') || '';
    const rating = $('.rtg i[itemprop="ratingValue"]').text().trim() || 'Tidak ada rating';
    const votes = $('.votescount').text().trim() || 'Tidak ada votes';

    const chapters = [];
    $('.listeps ul li').each((i, el) => {
      const chapterTitle = $(el).find('.lchx a').text().trim() || 'Tidak ada judul';
      const chapterLink = getPathFromUrl($(el).find('.lchx a').attr('href') || '');
      const releaseTime = $(el).find('.dt a').text().trim() || 'Tidak ada waktu rilis';
      
      chapters.push({
        judul_chapter: chapterTitle,
        link_chapter: chapterLink,
        waktu_rilis: releaseTime
      });
    });

    let chapterAwal = null;
    let chapterTerbaru = null;
    const epsbrDivs = $('.epsbr');
    
    if (epsbrDivs.length >= 2) {
      chapterAwal = {
        judul_chapter: $(epsbrDivs[0]).find('a').text().trim() || 'Tidak ada judul',
        link_chapter: getPathFromUrl($(epsbrDivs[0]).find('a').attr('href') || '')
      };
      
      chapterTerbaru = {
        judul_chapter: $(epsbrDivs[1]).find('a').text().trim() || 'Tidak ada judul',
        link_chapter: getPathFromUrl($(epsbrDivs[1]).find('a').attr('href') || '')
      };
    }

    const similarManga = [];
    $('.serieslist ul li').each((i, el) => {
      similarManga.push({
        judul: $(el).find('.leftseries h4 a').text().trim() || 'Tidak ada judul',
        link: getPathFromUrl($(el).find('.leftseries h4 a').attr('href') || ''),
        gambar: $(el).find('.imgseries a img').attr('src') || '',
        desk: $(el).find('.excerptmirip').text().trim() || 'Tidak ada desk'
      });
    });

    const spoilerImage = [];
    $('#spoiler .spoiler-img img').each((i, el) => {
      spoilerImage.push($(el).attr('src') || '');
    });

    const id = $('article').attr('id')?.replace('post-', '') || 'Tidak ada ID';
    
    const genre = [];
    $('.genre-info a').each((i, el) => {
      genre.push({
        nama: $(el).text().trim() || 'Tidak ada genre',
        link: getPathFromUrl($(el).attr('href') || '').replace('/genres/', '')
      });
    });

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
      komik_serupa: similarManga
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get chapter data
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<object>} - Chapter data
 */
async function getKomikChapter(chapterId) {
  const url = `${BASE_URL}/${chapterId}`;

  try {
    const htmlContent = await fetchHTML(url);
    const $ = cheerio.load(htmlContent);

    const results = {};
    results.id = $('article').attr('id')?.replace('post-', '') || 'Tidak ada ID';
    results.judul = $('.entry-title').text().trim() || 'Tidak ada judul';
    
    results.navigasi = {
      sebelumnya: getPathFromUrl($('a[rel="prev"]').attr('href') || ''),
      selanjutnya: getPathFromUrl($('a[rel="next"]').attr('href') || '')
    };

    const allchElement = $('a div.icol.daftarch');
    results.semua_chapter = allchElement.length 
      ? getPathFromUrl(allchElement.parent().attr('href')) 
      : null;

    results.gambar = [];
    $('.chapter-image img').each((index, el) => {
      const imgSrc = $(el).attr('src');
      if (imgSrc) {
        results.gambar.push({
          id: index + 1,
          url: imgSrc
        });
      }
    });

    const thumbnail = $('div.thumb img');
    results.thumbnail = thumbnail.length ? {
      url: thumbnail.attr('src'),
      judul: thumbnail.attr('title') || 'Tidak ada judul'
    } : null;

    results.info_komik = {
      judul: $('.infox h2').text().trim() || 'Tidak ada judul',
      desk: $('.shortcsc').text().trim() || 'Tidak ada desk',
      chapter: []
    };

    $('#chapter_list .lchx a').each((i, el) => {
      results.info_komik.chapter.push({
        judul_chapter: $(el).text().trim(),
        link_chapter: getPathFromUrl($(el).attr('href'))
      });
    });

    return results;
  } catch (error) {
    throw error;
  }
}

/**
 * Get manga library
 * @param {object} params - Search parameters
 * @returns {Promise<object>} - Manga library data
 */
async function getKomikLibrary(params) {
  let url = '';

  if (params.genre) {
    const genre = params.genre;
    const page = params.page || 1;
    url = `${BASE_URL}/daftar-manga/page/${page}/?genre%5B0%5D=${encodeURIComponent(genre)}&status&type&format&order&title`;
  } else if (params.page && params.s) {
    const page = params.page;
    const search = params.s;
    url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(search)}`;
  } else if (params.page && params.type) {
    const page = params.page;
    const type = params.type;
    url = `${BASE_URL}/daftar-manga/page/${page}/?status&type=${type}&format&order&title`;
  } else if (params.daftar) {
    const daftar = params.daftar;
    url = daftar == 1 ? `${BASE_URL}/daftar-manga/` : `${BASE_URL}/daftar-manga/page/${daftar}/`;
  } else {
    url = `${BASE_URL}/daftar-manga`;
  }

  try {
    const htmlContent = await fetchHTML(url);
    const $ = cheerio.load(htmlContent);

    const results = [];
    const komikPopuler = [];

    // Get manga by genre or category
    $('.animepost').each((i, el) => {
      const title = $(el).find('.tt h4').text().trim() || 'Tidak ada judul';
      const rating = $(el).find('.rating i').text().trim() || '0';
      const link = $(el).find('a[rel="bookmark"]').attr('href') || '';
      const image = $(el).find('img[itemprop="image"]').attr('src') || '';
      
      const typeElement = $(el).find('.typeflag');
      const type = typeElement.length 
        ? typeElement.attr('class')?.split(' ').pop() || 'Tidak ada tipe'
        : 'Tidak ada tipe';
        
      const color = $(el).find('.warnalabel').text().trim() || 'Hitam';

      results.push({
        judul: title,
        rating: rating,
        link: getPathFromUrl(link),
        gambar: image,
        tipe: type,
        warna: color
      });
    });

    // Get popular manga
    $('.serieslist.pop li').each((i, el) => {
      const rank = $(el).find('.ctr').text().trim() || 'Tidak ada peringkat';
      const title = $(el).find('h4 a').text().trim() || 'Tidak ada judul';
      const link = $(el).find('h4 a').attr('href') || '';
      const image = $(el).find('.imgseries img').attr('src') || '';
      const author = $(el).find('.author').text().trim() || 'Penulis tidak diketahui';
      
      const loveviewsElement = $(el).find('.loveviews');
      const rating = loveviewsElement.length 
        ? loveviewsElement.text().trim().split(' ').pop() || 'Tidak ada rating'
        : 'Tidak ada rating';

      komikPopuler.push({
        judul: title,
        link: getPathFromUrl(link),
        peringkat: rank,
        penulis: author,
        rating: rating,
        gambar: image
      });
    });

    // Determine total pages for pagination
    const pagination = $('.pagination a.page-numbers').last().prev();
    const totalPages = pagination.length 
      ? parseInt(pagination.text().trim()) || 1
      : 1;

    return {
      total_halaman: totalPages,
      komik: results,
      komik_populer: komikPopuler
    };
  } catch (error) {
    throw error;
  }
}

// API routes
app.get('/', (req, res) => {
  try {
    // If no parameters match, display API documentation
    const documentation = {
      name: 'CuymangaAPI',
      version: '1.1.0',
      description: 'CuymangaAPI adalah REST API buat web scraping yang ngambil data komik dari Komikindo2.com pakai Cheerio.',
      author: 'whyudacok (Node.js port by v0)',
      Website: 'https://whyuck.my.id',
      rate_limit: `${RATE_LIMIT} request per ${RATE_LIMIT_WINDOW/1000} detik`,
      endpoint: [
        {
          path: '?latest=1&page=1',
          desk: 'Mendapatkan daftar komik terbaru',
          parameter: {
            page: 'Nomor halaman (opsional, default: 1)'
          }
        },
        {
          path: '?komik=slug-komik',
          desk: 'Mendapatkan detail komik',
          parameter: {
            komik: 'ID atau slug komik'
          }
        },
        {
          path: '?chapter=slug-komik-chapter-1',
          desk: 'Mendapatkan data chapter komik',
          parameter: {
            chapter: 'ID atau slug chapter'
          }
        },
        {
          path: '?genre=action&page=1',
          desk: 'Mendapatkan daftar komik berdasarkan genre',
          parameter: {
            genre: 'Nama genre',
            page: 'Nomor halaman (Harus, default: 1)'
          }
        },
        {
          path: '?s=naruto&page=1',
          desk: 'Mencari komik',
          parameter: {
            s: 'Kata kunci pencarian',
            page: 'Nomor halaman (Harus, default: 1)'
          }
        },
        {
          path: '?daftar=1',
          desk: 'Mendapatkan daftar semua komik',
          parameter: {
            daftar: 'Nomor halaman (Harus, default: 1)'
          }
        },
        {
          path: '?type=manga&page=1',
          desk: 'Mendapatkan daftar komik berdasarkan tipe',
          parameter: {
            type: 'Tipe komik (manga, manhwa, manhua)',
            page: 'Nomor halaman (Harus, default: 1)'
          }
        }
      ]
    };
    
    return res.json({
      status: true,
      message: 'Docs CuymangaAPI',
      data: documentation
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      data: null,
      message: `Terjadi kesalahan: ${error.message}`
    });
  }
});

// Route handler for all API endpoints
app.get('/api', async (req, res) => {
  try {
    // Validate input
    const allowedParams = ['latest', 'komik', 'chapter', 'library', 'genre', 's', 'daftar', 'type', 'page'];
    for (const key in req.query) {
      if (!allowedParams.includes(key)) {
        return res.status(400).json({
          status: false,
          message: `Invalid parameter: ${key}`,
          data: null
        });
      }
    }

    // Determine request type based on parameters
    if (req.query.latest !== undefined) {
      const page = req.query.page ? parseInt(req.query.page) : 1;
      const data = await getLatestKomik(page);
      return res.json({
        status: true,
        message: 'OK',
        data: data
      });
    } else if (req.query.komik) {
      const komikId = req.query.komik;
      const data = await getKomikDetail(komikId);
      return res.json({
        status: true,
        message: 'OK',
        data: data
      });
    } else if (req.query.chapter) {
      const chapterId = req.query.chapter;
      const data = await getKomikChapter(chapterId);
      return res.json({
        status: true,
        message: 'OK',
        data: data
      });
    } else if (req.query.library !== undefined || req.query.genre || req.query.s || req.query.daftar || req.query.type) {
      const data = await getKomikLibrary(req.query);
      return res.json({
        status: true,
        message: 'OK',
        data: data
      });
    } else {
      // Redirect to documentation if no valid parameters
      return res.redirect('/');
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      data: null,
      message: `Terjadi kesalahan: ${error.message}`
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`CuymangaAPI server running on port ${PORT}`);
  console.log(`Documentation available at http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});

// Example usage:
// http://localhost:3000/api?latest=1&page=1
// http://localhost:3000/api?komik=one-piece
// http://localhost:3000/api?chapter=one-piece-chapter-1
console.log('Try these example endpoints:');
console.log('- Latest manga: /api?latest=1&page=1');
console.log('- Manga details: /api?komik=one-piece');
console.log('- Chapter data: /api?chapter=one-piece-chapter-1');
