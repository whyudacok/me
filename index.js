const axios = require("axios");
const cheerio = require("cheerio");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", async (req, res) => {
  try {
    const url = "https://v6.kuramanime.run/anime/1873/oshi-no-ko/episode/1";
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    let videoSources = [];
    $(".plyr__video-wrapper source").each((i, el) => {
      videoSources.push({
        url: $(el).attr("src"),
        type: $(el).attr("type"),
        size: $(el).attr("size"),
      });
    });

    res.json({ episode: "Oshi no Ko - Episode 1", videos: videoSources });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
           
