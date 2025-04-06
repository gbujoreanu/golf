const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const DATA_PATH = path.join(__dirname, 'scores_data_final.json');

app.use(express.static(__dirname));
app.use(express.json());

app.post('/add-rounds', (req, res) => {
  const newRounds = req.body;

  fs.readFile(DATA_PATH, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read data file.' });

    let rounds = [];
    try {
      rounds = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse JSON.' });
    }

    rounds = rounds.concat(newRounds);

    fs.writeFile(DATA_PATH, JSON.stringify(rounds, null, 2), (err) => {
      if (err) return res.status(500).json({ error: 'Failed to write new round.' });
      res.json({ success: true });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
