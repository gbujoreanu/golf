const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const SCORES_PATH = path.join(__dirname, 'scores_data_final.json');
const COURSES_PATH = path.join(__dirname, 'courses.json');

app.use(express.static(__dirname));
app.use(express.json());

// GET rounds
app.get('/scores', (req, res) => {
  fs.readFile(SCORES_PATH, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read scores file.' });
    try {
      const rounds = JSON.parse(data);
      res.json(rounds);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse scores JSON.' });
    }
  });
});

// POST new rounds
app.post('/add-rounds', (req, res) => {
  const newRounds = req.body;
  fs.readFile(SCORES_PATH, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read scores file.' });
    let rounds = [];
    try {
      rounds = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse scores JSON.' });
    }
    rounds = rounds.concat(newRounds);
    fs.writeFile(SCORES_PATH, JSON.stringify(rounds, null, 2), (err) => {
      if (err) return res.status(500).json({ error: 'Failed to write scores file.' });
      res.json({ success: true });
    });
  });
});

// GET courses
app.get('/courses', (req, res) => {
  fs.readFile(COURSES_PATH, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read courses file.' });
    try {
      const courses = JSON.parse(data);
      res.json(courses);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse courses JSON.' });
    }
  });
});

// POST add new course
app.post('/add-course', (req, res) => {
  const newCourse = req.body;
  fs.readFile(COURSES_PATH, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read courses file.' });
    let courses = [];
    try {
      courses = JSON.parse(data);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse courses JSON.' });
    }
    courses.push(newCourse);
    fs.writeFile(COURSES_PATH, JSON.stringify(courses, null, 2), (err) => {
      if (err) return res.status(500).json({ error: 'Failed to write courses file.' });
      res.json({ success: true });
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
module.exports = app;
