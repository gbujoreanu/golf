const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const SCORES_PATH = path.join(__dirname, 'scores_data_final.json');
const COURSES_PATH = path.join(__dirname, 'courses.json');

app.use(express.static(__dirname));
app.use(express.json());

// GET rounds endpoint
app.get('/scores', (req, res) => {
  fs.readFile(SCORES_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading scores file:", err);
      return res.status(500).json({ error: 'Failed to read scores file.' });
    }
    try {
      const rounds = JSON.parse(data);
      res.json(rounds);
    } catch (e) {
      console.error("Error parsing scores JSON:", e);
      res.status(500).json({ error: 'Failed to parse scores JSON.' });
    }
  });
});

// POST new rounds endpoint
app.post('/add-rounds', (req, res) => {
  const newRounds = req.body;
  fs.readFile(SCORES_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading scores file:", err);
      return res.status(500).json({ error: 'Failed to read scores file.' });
    }
    let rounds = [];
    try {
      rounds = JSON.parse(data);
    } catch (e) {
      console.error("Error parsing scores JSON:", e);
      return res.status(500).json({ error: 'Failed to parse scores JSON.' });
    }
    rounds = rounds.concat(newRounds);
    fs.writeFile(SCORES_PATH, JSON.stringify(rounds, null, 2), (err) => {
      if (err) {
        console.error("Error writing scores file:", err);
        return res.status(500).json({ error: 'Failed to write scores file.' });
      }
      res.json({ success: true });
    });
  });
});

// GET courses endpoint
app.get('/courses', (req, res) => {
  fs.readFile(COURSES_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading courses file:", err);
      return res.status(500).json({ error: 'Failed to read courses file.' });
    }
    console.log("Courses data:", data);
    try {
      const courses = JSON.parse(data);
      res.json(courses);
    } catch (e) {
      console.error("Error parsing courses JSON:", e);
      res.status(500).json({ error: 'Failed to parse courses JSON.' });
    }
  });
});

// POST add new course endpoint
// UPDATED: Merge new data with existing “tees” array if the course exists
app.post('/add-course', (req, res) => {
  const newCourse = req.body;
  fs.readFile(COURSES_PATH, 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading courses file:", err);
      return res.status(500).json({ error: 'Failed to read courses file.' });
    }
    let courses = [];
    try {
      courses = JSON.parse(data);
    } catch (e) {
      console.error("Error parsing courses JSON:", e);
      return res.status(500).json({ error: 'Failed to parse courses JSON.' });
    }

    // Check if this course name already exists
    const existingCourse = courses.find(c => c.course === newCourse.course);
    if (existingCourse) {
      // Add a new tee to the existing course’s tees array
      existingCourse.tees.push({
        tee: newCourse.tee,
        rating: newCourse.rating,
        slope: newCourse.slope,
        teeColor: newCourse.teeColor
      });
    } else {
      // Create a brand-new course object with a tees array
      courses.push({
        course: newCourse.course,
        tees: [
          {
            tee: newCourse.tee,
            rating: newCourse.rating,
            slope: newCourse.slope,
            teeColor: newCourse.teeColor
          }
        ]
      });
    }

    fs.writeFile(COURSES_PATH, JSON.stringify(courses, null, 2), (err) => {
      if (err) {
        console.error("Error writing courses file:", err);
        return res.status(500).json({ error: 'Failed to write courses file.' });
      }
      res.json({ success: true });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;
