document.addEventListener("DOMContentLoaded", () => {
  const scorecardBody = document.getElementById("scorecardBody");
  const newRoundsTable = document.getElementById("newRoundsTable");
  const addRoundsForm = document.getElementById("newRoundsForm");
  const generateBtn = document.getElementById("generateRowsBtn");
  const numRows = document.getElementById("numRows");
  
  let coursesList = [];
  
  // Fetch courses for the new rounds dropdown
  fetch('/courses')
    .then(res => res.json())
    .then(data => {
      coursesList = data;
    })
    .catch(err => {
      console.error("Error fetching courses:", err);
    });
  
  // Load and render existing rounds
  fetch("scores_data_final.json")
    .then(res => res.json())
    .then(data => {
      scorecardBody.innerHTML = "";
      data.forEach(entry => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${entry.name}</td>
          ${entry.holes.map(score => `<td>${score}</td>`).join("")}
          <td class="sub-total">${entry.front9}</td>
          <td class="sub-total">${entry.back9}</td>
          <td class="total-cell">${entry.total}</td>
          <td>${entry.date}</td>
          <td>${entry.course}</td>
          <td>${entry.tee}</td>
        `;
        scorecardBody.appendChild(row);
      });
    })
    .catch(err => console.error("Error loading rounds:", err));
  
  // Helper: get unique course names from coursesList
  function getUniqueCourses() {
    return [...new Set(coursesList.map(c => c.course))];
  }
  
  // Generate new input rows
  generateBtn.addEventListener("click", () => {
    const count = parseInt(numRows.value, 10);
    newRoundsTable.querySelector("tbody").innerHTML = "";
    for (let i = 0; i < count; i++) {
      const row = document.createElement("tr");
      // Build course dropdown from coursesList
      const courseOptions = getUniqueCourses().map(course =>
        `<option value="${course}">${course}</option>`
      ).join("");
      
      row.innerHTML = `
        <!-- Name, Date -->
        <td><input type="text" name="name" placeholder="Name" required></td>
        <td><input type="date" name="date" required></td>
        <!-- Course dropdown -->
        <td>
          <select name="course" class="course-select" required>
            <option value="">Select Course</option>
            ${courseOptions}
          </select>
        </td>
        <!-- Tee dropdown (populated based on course) -->
        <td>
          <select name="tee" class="tee-select" required>
            <option value="">Select Tee</option>
          </select>
        </td>
        <!-- Front 9 holes -->
        ${Array.from({ length: 9 }, (_, j) => `
          <td><input type="number" class="hole-input" name="hole${j}" min="1" placeholder="${j+1}" required></td>
        `).join("")}
        <!-- F9 -->
        <td class="f9-cell sub-total">0</td>
        <!-- Back 9 holes -->
        ${Array.from({ length: 9 }, (_, j) => `
          <td><input type="number" class="hole-input" name="hole${j+9}" min="1" placeholder="${j+10}" required></td>
        `).join("")}
        <!-- B9 -->
        <td class="b9-cell sub-total">0</td>
        <!-- Total -->
        <td class="total-cell">0</td>
      `;
      newRoundsTable.querySelector("tbody").appendChild(row);
      attachCalculationListeners(row);
      
      // Update tee dropdown based on selected course
      const courseSelect = row.querySelector(".course-select");
      const teeSelect = row.querySelector(".tee-select");
      courseSelect.addEventListener("change", () => {
        const selectedCourse = courseSelect.value;
        const availableTees = coursesList
          .filter(c => c.course === selectedCourse)
          .map(c => c.tee);
        const uniqueTees = [...new Set(availableTees)];
        teeSelect.innerHTML = '<option value="">Select Tee</option>' +
          uniqueTees.map(tee => `<option value="${tee}">${tee}</option>`).join("");
      });
    }
  });
  
  // Real-time calculation for F9, B9, Total
  function attachCalculationListeners(row) {
    const holeInputs = row.querySelectorAll(".hole-input");
    const f9Cell = row.querySelector(".f9-cell");
    const b9Cell = row.querySelector(".b9-cell");
    const totalCell = row.querySelector(".total-cell");
    
    holeInputs.forEach(input => {
      input.addEventListener("input", () => {
        let front9 = 0, back9 = 0;
        holeInputs.forEach((inp, idx) => {
          const val = parseInt(inp.value) || 0;
          if (idx < 9) front9 += val;
          else back9 += val;
        });
        f9Cell.textContent = front9;
        b9Cell.textContent = back9;
        totalCell.textContent = front9 + back9;
      });
    });
  }
  
  // Handle form submission for new rounds
  addRoundsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const rows = newRoundsTable.querySelectorAll("tbody tr");
    const newRounds = [];
    rows.forEach(row => {
      const inputs = row.querySelectorAll("input, select");
      const name = inputs[0].value.trim();
      const date = inputs[1].value.trim();
      const course = inputs[2].value;
      const tee = inputs[3].value;
      const holes = Array.from(inputs).slice(4, 22).map(inp => parseInt(inp.value) || 0);
      const front9 = holes.slice(0, 9).reduce((a, b) => a + b, 0);
      const back9 = holes.slice(9).reduce((a, b) => a + b, 0);
      const total = front9 + back9;
      if (!name || !date || !course || !tee || holes.includes(0)) return;
      newRounds.push({ name, date, course, tee, holes, front9, back9, total });
    });
    if (!newRounds.length) {
      return alert("Please complete all fields correctly.");
    }
    fetch("/add-rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRounds)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          location.reload();
        } else {
          alert("Failed to save rounds.");
        }
      })
      .catch(err => {
        console.error("Error saving rounds:", err);
        alert("Server error while saving.");
      });
  });
});

