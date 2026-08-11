const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: '*' }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('============================================================');
  console.log(` 🪩  HORN OK PLEASE / LET'S VIBE SERVER ONLINE`);
  console.log(` 🚗  Running locally at: http://localhost:${PORT}/`);
  console.log('============================================================');
});
