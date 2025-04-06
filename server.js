const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_PATH = path.join(__dirname, 'scores_data_final.json');

app.use(express.static(__dirname));
app.use(express.json());

// Endpoint to fetch scores from the JSON file
app.get('/scores', (req, res) => {
  fs.readFile(DATA_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading JSON file:", err);
      return res.status(500).json({ error: 'Failed to read JSON file' });
    }
    try {
      const rounds = JSON.parse(data);
      res.json(rounds);
    } catch (e) {
      console.error("Error parsing JSON:", e);
      res.status(500).json({ error: 'Failed to parse JSON file' });
    }
  });
});

// Endpoint to add new rounds and update the JSON file
app.post('/add-rounds', (req, res) => {
  fs.readFile(DATA_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading JSON file:", err);
      return res.status(500).json({ error: 'Failed to read JSON file' });
    }
    let rounds = [];
    try {
      rounds = JSON.parse(data);
    } catch (e) {
      console.error("Error parsing JSON:", e);
      return res.status(500).json({ error: 'Failed to parse JSON file' });
    }
    rounds = rounds.concat(req.body);
    fs.writeFile(DATA_PATH, JSON.stringify(rounds, null, 2), (err) => {
      if (err) {
        console.error("Error writing JSON file:", err);
        return res.status(500).json({ error: 'Failed to write JSON file' });
      }
      res.json({ success: true });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
