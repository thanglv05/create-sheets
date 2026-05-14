const axios = require('axios');

/**
 * Gọi API Scrape để lấy thông tin từ URL
 */
async function scrapeUrl(url) {
  try {
    const response = await axios.post('https://crawl.likepion.com/scrape', { url }, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Scrape API Error:', error.response?.data || error.message);
    throw new Error(`Lỗi Scrape: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Ánh xạ dữ liệu trả về từ API vào mảng giá trị cho cột C (dòng 2-15)
 * @param {Object} data - Dữ liệu từ API
 * @returns {Array[]} Mảng 2 chiều [[v2], [v3], ..., [v15]]
 */
function mapScrapeDataToSheet(data) {
  // Lấy từ businessProfile theo format API trả về
  const p = data.businessProfile || {};
  
  return [
    [p.firstName || ""],             // C2: FIRST NAME
    [p.lastName || ""],              // C3: LAST NAME
    [p.city || ""],                  // C4: CITY
    [p.phone || ""],                 // C5: PHONE
    [p.address || ""],               // C6: ADDRESS
    [p.about || ""],                 // C7: ABOUT
    [p.logo || ""],                  // C8: LOGO
    [p.banner || ""],                // C9: BANNER
    [p.username || ""],              // C10: USERNAME
    [data.gmail || data.email || ""], // C11: GMAIL (ngoài profile)
    [data.pass || data.password || ""], // C12: PASS
    [data.appPassword || ""],        // C13: APP PASSWORD
    [data.twoFA || ""],              // C14: 2FA
    [data.recoveryEmail || ""]       // C15: RECOVERY EMAIL
  ];
}

module.exports = { scrapeUrl, mapScrapeDataToSheet };
