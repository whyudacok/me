/**
 * CuymangaAPI
 *
 * Version: 1.1.0
 * Author: whyudacok
 * License: MIT
 * Website: https://whyuck.my.id
 *
 * Copyright (c) 2025 whyudacok
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import express from 'express';
import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Configuration
const BASE_URL = 'https://komikindo2.com'; // keep monitoring this
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0';
const RATE_LIMIT = 60; // Requests per minute
const RATE_LIMIT_WINDOW = 60; // Time window in seconds

const app = express();
const port = process.env.PORT || 3000;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('Content-Type', 'application/json; charset=utf-8');
  next();
});

/**
 * Function to check rate limit
 * 
 * @param {string} clientIP - Client IP address
 * @returns {boolean} True if within limits, False if exceeded
 */
function checkRateLimit(clientIP) {
  const tempDir = os.tmpdir();
  const cacheFile = path.join(tempDir, `rate_limit_${Buffer.from(clientIP).toString('hex')}.json`);
  
  let data = { count: 1, time: Date.now() / 1000 };
  
  if (fs.existsSync(cacheFile)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const currentTime = Date.now() / 1000;
      
      if (currentTime - fileData.time < RATE_LIMIT_WINDOW) {
        if (fileData.count >= RATE_LIMIT) {
          return false;
        }
        data = { count: fileData.count + 1, time: fileData.time };
      }
    } catch (error) {
      console.error('Error reading rate limit file:', error);
    }
  }
  
  fs.writeFileSync(cacheFile, JSON.stringify(data));
  return true;
}

/**
 * Function to display JSON response
 * 
 * @param {object} res - Express response object
 * @param {object} data - Data to display
 * @param {number} statusCode - HTTP status code
 */
function displayPrettyJson(res, data, statusCode = 200) {
  res.status(statusCode).json(data);
}

/**
 * Function to fetch HTML using axios
 * 
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML content
 */
async function fetchHTML(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      },
      timeout: 30000,
      maxRedirects: 5
    });
    return response.data;
  } catch (error) {
    throw new Error(`Error fetching URL: ${error.message}`);
  }
}

/**
 * Function to convert URL to path
 * 
 * @param {string} url - Full URL
 * @returns {string} Path from URL
 */
function getPathFromUrl(url) {
  if (!url) return '';
  if (url.startsWith(BASE_URL)) {
    const urlObj = new URL(url);
    return urlObj.pathname;
  }
  return url;
}

/**
 * Function to clean text
 * 
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Get latest manga
 * 
 * @param {number} page - Page number
 * @returns {Promise<object>} Latest manga data
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
      const title = $(el).find('.tt h4').text().trim() || 'No title';
      const link = getPathFromUrl($(el).find('a[rel="bookmark"]').attr('href') || '');
      const image = $(el).find('img[itemprop="image"]').attr('src') || '';
      const typeClass = $(el).find('.typeflag').attr('class') || '';
      const type = typeClass.split(' ').pop() || 'No type';
      const color = $(el).find('.warnalabel').text().trim() || 'Black';
      
      const chapter = [];
      $(el).find('.lsch').each((j, chEl) => {
        const chTitle = $(chEl).find('a').text().trim().replace('Ch.', 'Chapter') || 'Chapter without title';
        const chLink = getPathFromUrl($(chEl).find('a').attr('href') || '');
        const chDate = $(chEl).find('.datech').text().trim() || 'No date';
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
      const rank = $(el).find('.ctr').text().trim() || 'No rank';
      const title = $(el).find('h4 a').text().trim() || 'No title';
      const link = getPathFromUrl($(el).find('h4 a').attr('href') || '');
      const image = $(el).find('.imgseries img').attr('src') || '';
      const author = $(el).find('.author').text().trim() || 'Unknown author';
      const ratingText = $(el).find('.loveviews').text().trim() || 'No rating';
      const rating = ratingText.split(' ').pop() || 'No rating';
      
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
    const totalPages = pagination.length > 1 ? 
      parseInt($(pagination[pagination.length - 2]).text().trim()) : 1;
    
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
 * 
 * @param {string} komikId - Manga ID
 * @returns {Promise<object>} Manga details
 */
async function getKomikDetail(komikId) {
  const url = `${BASE_URL}/komik/${komikId}`;
  
  try {
    const htmlContent = await fetchHTML(url);
    const $ = cheerio.load(htmlContent);
    
    const title = $('.entry-title').text().trim() || 'No title';
    const description = cleanText($('.entry-content.entry-content-single[itemprop="description"] p').text()) || 'No description';
    
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
      const value = cleanText($(el).text().replace(`${key}:`, ''));
      
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
    const rating = $('.rtg i[itemprop="ratingValue"]').text().trim() || 'No rating';
    const votes = $('.votescount').text().trim() || 'No votes';
    
    const chapters = [];
    $('.listeps ul li').each((i, el) => {
      const chapterTitle = $(el).find('.lchx a').text().trim() || 'No title';
      const chapterLink = getPathFromUrl($(el).find('.lchx a').attr('href') || '');
      const releaseTime = $(el).find('.dt a').text().trim() || 'No release time';
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
        judul_chapter: $(epsbrDivs[0]).find('a').text().trim() || 'No title',
        link_chapter: getPathFromUrl($(epsbrDivs[0]).find('a').attr('href') || '')
      };
      chapterTerbaru = {
        judul_chapter: $(epsbrDivs[1]).find('a').text().trim() || 'No title',
        link_chapter: getPathFromUrl($(epsbrDivs[1]).find('a').attr('href') || '')
      };
    }
    
    const similarManga = [];
    $('.serieslist ul li').each((i, el) => {
      similarManga.push({
        judul: $(el).find('.leftseries h4 a').text().trim() || 'No title',
        link: getPathFromUrl($(el).find('.leftseries h4 a').attr('href') || ''),
        gambar: $(el).find('.imgseries a img').attr('src') || '',
        desk: $(el).find('.excerptmirip').text().trim() || 'No description'
      });
    });
    
    const spoilerImage = [];
    $('#spoiler .spoiler-img img').each((i, el) => {
      spoilerImage.push($(el).attr('src') || '');
    });
    
    const id = $('article').attr('id')?.replace('post-', '') || 'No ID';
    const genre = [];
    $('.genre-info a').each((i, el) => {
      genre.push({
        nama: $(el).text().trim() || 'No genre',
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
 * Get manga chapter data
 * 
 * @param {string} chapterId - Chapter ID
 * @returns {Promise<object>} Chapter data
 */
async function getKomikChapter(chapterId) {
  const url = `${BASE_URL}/${chapterId}`;
  
  try {
    const htmlContent = await fetchHTML(url);
    const $ = cheerio.load(htmlContent);
    
    const results = {};
    results.id = $('article').attr('id')?.replace('post-', '') || 'No ID';
    results.judul = $('.entry-title').text().trim() || 'No title';
    results.navigasi = {
      sebelumnya: getPathFromUrl($('a[rel="prev"]').attr('href') || ''),
      selanjutnya: getPathFromUrl($('a[rel="next"]').attr('href') || '')
    };
    
    const allchElement = $('a div.icol.daftarch');
    results.semua_chapter = allchElement.length ? 
      getPathFromUrl(allchElement.parent().attr('href')) : null;
    
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
      judul: thumbnail.attr('title') || 'No title'
    } : null;
    
    results.info_komik = {
      judul: $('.infox h2').text().trim() || 'No title',
      desk: $('.shortcsc').text().trim() || 'No description',
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
 * 
 * @param {object} params - Search parameters
 * @returns {Promise<object>} Manga library
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
      const title = $(el).find('.tt h4').text().trim() || 'No title';
      const rating = $(el).find('.rating i').text().trim() || '0';
      const link = $(el).find('a[rel="bookmark"]').attr('href') || '';
      const image = $(el).find('img[itemprop="image"]').attr('src') || '';
      const typeClass = $(el).find('.typeflag').attr('class') || '';
      const type = typeClass ? typeClass.split(' ').pop() : 'No type';
      const color = $(el).find('.warnalabel').text().trim() || 'Black';
      
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
      const rank = $(el).find('.ctr').text().trim() || 'No rank';
      const title = $(el).find('h4 a').text().trim() || 'No title';
      const link = $(el).find('h4 a').attr('href') || '';
      const image = $(el).find('.imgseries img').attr('src') || '';
      const author = $(el).find('.author').text().trim() || 'Unknown author';
      const ratingText = $(el).find('.loveviews').text().trim() || '';
      const rating = ratingText ? ratingText.split(' ').pop() : 'No rating';
      
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
    const totalPages = pagination.length ? parseInt(pagination.text().trim()) : 1;
    
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
app.get('/', async (req, res) => {
  try {
    // Check rate limit
    const clientIP = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(clientIP)) {
      return displayPrettyJson(res, {
        status: false,
        message: 'Rate limit exceeded. Please try again later.',
        data: null
      }, 429); // 429 Too Many Requests
    }
    
    // Validate input
    const allowedParams = ['latest', 'komik', 'chapter', 'library', 'genre', 's', 'daftar', 'type', 'page'];
    for (const key in req.query) {
      if (!allowedParams.includes(key)) {
        return displayPrettyJson(res, {
          status: false,
          message: `Invalid parameter: ${key}`,
          data: null
        }, 400); // 400 Bad Request
      }
    }
    
    // Determine request type based on parameters
    if (req.query.latest !== undefined) {
      const page = req.query.page ? parseInt(req.query.page) : 1;
      const data = await getLatestKomik(page);
      return displayPrettyJson(res, {
        status: true,
        message: 'OK',
        data: data
      });
    } else if (req.query.komik) {
      const komikId = req.query.komik;
      const data = await getKomikDetail(komikId);
      return displayPrettyJson(res, {
        status: true,
        message: 'OK',
        data: data
      });
    } else if (req.query.chapter) {
      const chapterId = req.query.chapter;
      const data = await getKomikChapter(chapterId);
      return displayPrettyJson(res, {
        status: true,
        message: 'OK',
        data: data
      });
    } else if (req.query.library !== undefined || req.query.genre || req.query.s || req.query.daftar || req.query.type) {
      const data = await getKomikLibrary(req.query);
      return displayPrettyJson(res, {
        status: true,
        message: 'OK',
        data: data
      });
    } else {
      // If no matching parameters, display API documentation
      const documentation = {
        name: 'CuymangaAPI',
        version: '1.1.0',
        description: 'CuymangaAPI is a REST API for web scraping that retrieves manga data from Komikindo2.com using Cheerio.',
        author: 'whyudacok',
        Website: 'https://whyuck.my.id',
        rate_limit: `${RATE_LIMIT} requests per ${RATE_LIMIT_WINDOW} seconds`,
        endpoint: [
          {
            path: '?latest=1&page=1',
            desk: 'Get latest manga list',
            parameter: {
              page: 'Page number (optional, default: 1)'
            }
          },
          {
            path: '?komik=slug-komik',
            desk: 'Get manga details',
            parameter: {
              komik: 'Manga ID or slug'
            }
          },
          {
            path: '?chapter=slug-komik-chapter-1',
            desk: 'Get manga chapter data',
            parameter: {
              chapter: 'Chapter ID or slug'
            }
          },
          {
            path: '?genre=action&page=1',
            desk: 'Get manga list by genre',
            parameter: {
              genre: 'Genre name',
              page: 'Page number (required, default: 1)'
            }
          },
          {
            path: '?s=naruto&page=1',
            desk: 'Search manga',
            parameter: {
              s: 'Search keyword',
              page: 'Page number (required, default: 1)'
            }
          },
          {
            path: '?daftar=1',
            desk: 'Get all manga list',
            parameter: {
              daftar: 'Page number (required, default: 1)'
            }
          },
          {
            path: '?type=manga&page=1',
            desk: 'Get manga list by type',
            parameter: {
              type: 'Manga type (manga, manhwa, manhua)',
              page: 'Page number (required, default: 1)'
            }
          }
        ]
      };
      return displayPrettyJson(res, {
        status: true,
        message: 'Docs CuymangaAPI',
        data: documentation
      });
    }
  } catch (error) {
    return displayPrettyJson(res, {
      status: false,
      data: null,
      message: `An error occurred: ${error.message}`
    }, 500); // 500 Internal Server Error
  }
});

// Start the server
app.listen(port, () => {
  console.log(`CuymangaAPI server running on port ${port}`);
  console.log(`Visit http://localhost:${port} to see API documentation`);
});

// For testing purposes, let's call one of the functions
const testFunction = async () => {
  try {
    console.log('Testing getLatestKomik function:');
    const latestData = await getLatestKomik(1);
    console.log(`Found ${latestData.komik.length} latest manga`);
    console.log(`Found ${latestData.komik_populer.length} popular manga`);
    console.log('Total pages:', latestData.total_halaman);
    
    if (latestData.komik.length > 0) {
      console.log('\nSample manga data:');
      console.log(`Title: ${latestData.komik[0].judul}`);
      console.log(`Link: ${latestData.komik[0].link}`);
      console.log(`Type: ${latestData.komik[0].tipe}`);
      
      if (latestData.komik[0].chapter.length > 0) {
        console.log('\nLatest chapter:');
        console.log(`Title: ${latestData.komik[0].chapter[0].judul}`);
        console.log(`Link: ${latestData.komik[0].chapter[0].link}`);
        console.log(`Release date: ${latestData.komik[0].chapter[0].tanggal_rilis}`);
      }
    }
    
    console.log('\nAPI is ready to use!');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
};

// Run the test function
testFunction();
