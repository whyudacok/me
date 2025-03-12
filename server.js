const express = require("express")
const rateLimit = require("express-rate-limit")
const scraper = require("./scraper")

const app = express()

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: false,
    message: "Rate limit exceeded. Please try again later.",
    data: null,
  },
})

// Apply rate limiting to all requests
app.use(limiter)

// Set headers for all responses
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Cache-Control", "post-check=0, pre-check=0")
  res.setHeader("Pragma", "no-cache")
  next()
})

// Main route handler
app.get("/", async (req, res) => {
  try {
    // Validate input parameters
    const allowedParams = ["latest", "komik", "chapter", "library", "genre", "s", "daftar", "type", "page"]
    const invalidParams = Object.keys(req.query).filter((key) => !allowedParams.includes(key))

    if (invalidParams.length > 0) {
      return res.status(400).json({
        status: false,
        message: `Invalid parameter: ${invalidParams[0]}`,
        data: null,
      })
    }

    // Handle different request types based on parameters
    if (req.query.latest !== undefined) {
      const page = req.query.page ? Number.parseInt(req.query.page) : 1
      const data = await scraper.getLatestKomik(page)
      return res.json({
        status: true,
        message: "OK",
        data,
      })
    } else if (req.query.komik) {
      const data = await scraper.getKomikDetail(req.query.komik)
      return res.json({
        status: true,
        message: "OK",
        data,
      })
    } else if (req.query.chapter) {
      const data = await scraper.getKomikChapter(req.query.chapter)
      return res.json({
        status: true,
        message: "OK",
        data,
      })
    } else if (
      req.query.library !== undefined ||
      req.query.genre ||
      req.query.s ||
      req.query.daftar ||
      req.query.type
    ) {
      const data = await scraper.getKomikLibrary(req.query)
      return res.json({
        status: true,
        message: "OK",
        data,
      })
    } else {
      // If no parameters match, display API documentation
      const documentation = {
        name: "CuymangaAPI",
        version: "1.1.0",
        description:
          "CuymangaAPI adalah REST API buat web scraping yang ngambil data komik dari Komikindo2.com pakai Cheerio.",
        author: "whyudacok",
        Website: "https://whyuck.my.id",
        rate_limit: "60 request per 60 detik",
        endpoint: [
          {
            path: "?latest=1&page=1",
            desk: "Mendapatkan daftar komik terbaru",
            parameter: {
              page: "Nomor halaman (opsional, default: 1)",
            },
          },
          {
            path: "?komik=slug-komik",
            desk: "Mendapatkan detail komik",
            parameter: {
              komik: "ID atau slug komik",
            },
          },
          {
            path: "?chapter=slug-komik-chapter-1",
            desk: "Mendapatkan data chapter komik",
            parameter: {
              chapter: "ID atau slug chapter",
            },
          },
          {
            path: "?genre=action&page=1",
            desk: "Mendapatkan daftar komik berdasarkan genre",
            parameter: {
              genre: "Nama genre",
              page: "Nomor halaman (Harus, default: 1)",
            },
          },
          {
            path: "?s=naruto&page=1",
            desk: "Mencari komik",
            parameter: {
              s: "Kata kunci pencarian",
              page: "Nomor halaman (Harus, default: 1)",
            },
          },
          {
            path: "?daftar=1",
            desk: "Mendapatkan daftar semua komik",
            parameter: {
              daftar: "Nomor halaman (Harus, default: 1)",
            },
          },
          {
            path: "?type=manga&page=1",
            desk: "Mendapatkan daftar komik berdasarkan tipe",
            parameter: {
              type: "Tipe komik (manga, manhwa, manhua)",
              page: "Nomor halaman (Harus, default: 1)",
            },
          },
        ],
      }

      return res.json({
        status: true,
        message: "Docs CuymangaAPI",
        data: documentation,
      })
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      data: null,
      message: `Terjadi kesalahan: ${error.message}`,
    })
  }
})

// For Vercel serverless deployment
module.exports = app

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

  
