const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Open (or create) the SQLite database file.
const db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
    console.error('Could not connect to database:', err);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create the scores table if it doesn't exist.
db.run(`CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  date TEXT,
  course TEXT,
  tee TEXT,
  holes TEXT,
  front9 INTEGER,
  back9 INTEGER,
  total INTEGER
)`, (err) => {
  if (err) {
    console.error('Error creating table:', err);
  }
});

// Endpoint to add new rounds.
app.post('/add-rounds', (req, res) => {
  const newRounds = req.body;
  if (!Array.isArray(newRounds)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }
  
  let completed = 0;
  const totalRounds = newRounds.length;

  newRounds.forEach(round => {
    const { name, date, course, tee, holes, front9, back9, total } = round;
    // Convert the holes array to a JSON string.
    const holesString = JSON.stringify(holes);
    db.run(
      "INSERT INTO scores (name, date, course, tee, holes, front9, back9, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [name, date, course, tee, holesString, front9, back9, total],
      function(err) {
        if (err) {
          console.error('Error inserting data:', err);
          return res.status(500).json({ error: 'Failed to insert data' });
        } else {
          completed++;
          if (completed === totalRounds) {
            res.json({ success: true });
          }
        }
      }
    );
  });
});

// Endpoint to fetch all rounds.
app.get('/scores', (req, res) => {
  db.all("SELECT * FROM scores", [], (err, rows) => {
    if (err) {
      console.error('Error fetching data:', err);
      return res.status(500).json({ error: 'Failed to fetch data' });
    }
    // Parse the holes JSON string back into an array.
    const rounds = rows.map(row => ({
      id: row.id,
      name: row.name,
      date: row.date,
      course: row.course,
      tee: row.tee,
      holes: JSON.parse(row.holes),
      front9: row.front9,
      back9: row.back9,
      total: row.total
    }));
    res.json(rounds);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
