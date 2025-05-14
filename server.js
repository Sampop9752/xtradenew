const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const workbookPath = path.join(__dirname, 'leads.xlsx');

// Initialize Excel file
async function initExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leads');
  worksheet.columns = [
    { header: 'Full Name', key: 'fullName' },
    { header: 'Email', key: 'email' },
    { header: 'Country', key: 'countryCodeISO2' },
    { header: 'Phone Code', key: 'phoneCountryCode' },
    { header: 'Phone Number', key: 'phoneNumber' },
    { header: 'Language', key: 'language' },
    { header: 'Age', key: 'age' },
    { header: 'affTrack', key: 'affTrack' },
    { header: 'affToken', key: 'affToken' },
    { header: 'User IP', key: 'userIp' }
  ];
  await workbook.xlsx.writeFile(workbookPath);
}

if (!fs.existsSync(workbookPath)) {
  initExcel();
}

app.post('/submit', async (req, res) => {
  const {
    name,
    email,
    phone,
    country,
    age,
    language,
    affTrack,
    affToken
  } = req.body;

  // Get client IP address
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // Extract phone parts
  const phoneCountryCode = phone.startsWith('+') ? phone.slice(1, 4) : '971';
  const phoneNumber = phone.replace(/\D/g, '').slice(phoneCountryCode.length);

  const payload = {
    email,
    fullName: name,
    countryCodeISO2: country,
    phoneCountryCode,
    phoneNumber,
    emailOpt: 'OPT_OUT',
    language,
    provider: '14',
    affTrack,
    affToken,
    userIp
  };

  const formEncoded = new URLSearchParams(payload).toString();

  try {
    const xtradeRes = await axios.post('https://www.xtrade.com/api/lead/create', formEncoded, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Save lead locally in Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(workbookPath);
    const worksheet = workbook.getWorksheet('Leads');
    worksheet.addRow({
      fullName: name,
      email,
      countryCodeISO2: country,
      phoneCountryCode,
      phoneNumber,
      language,
      age,
      affTrack,
      affToken,
      userIp
    });
    await workbook.xlsx.writeFile(workbookPath);

    return res.json({ success: true, xtradeResponse: xtradeRes.data });
  } catch (err) {
    console.error('❌ Xtrade Error:', err.response?.data || err.message);
    return res.status(500).json({
      error: 'Failed to send lead to Xtrade.',
      details: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
