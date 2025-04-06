document.addEventListener("DOMContentLoaded", () => {
  const scorecardBody = document.getElementById("scorecardBody");
  const filterNameInput = document.getElementById("filterName");
  const filterCourseInput = document.getElementById("filterCourse");
  const filterTeeSelect = document.getElementById("filterTee");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  let allRounds = []; // This will store all loaded rounds

  // Function to render rounds into the scoreboard table
  function renderRounds(rounds) {
    scorecardBody.innerHTML = "";
    rounds.forEach(entry => {
      const row = document.createElement("tr");
      // Split holes into front 9 and back 9
      const frontHoles = entry.holes.slice(0, 9).map(score => `<td>${score}</td>`).join("");
      const backHoles  = entry.holes.slice(9, 18).map(score => `<td>${score}</td>`).join("");
      row.innerHTML = `
        <td>${entry.name}</td>
        ${frontHoles}
        <td class="sub-total">${entry.front9}</td>
        ${backHoles}
        <td class="sub-total">${entry.back9}</td>
        <td class="total-cell">${entry.total}</td>
        <td>${entry.date}</td>
        <td>${entry.course}</td>
        <td>${entry.tee}</td>
      `;
      scorecardBody.appendChild(row);
    });
  }

  // Load rounds from the JSON file
  fetch("scores_data_final.json")
    .then(res => res.json())
    .then(data => {
      allRounds = data;
      renderRounds(allRounds);
    })
    .catch(err => console.error("Error loading JSON:", err));

  // Filter function to filter rounds by name, course, or tee
  function filterRounds() {
    const nameFilter = filterNameInput.value.toLowerCase();
    const courseFilter = filterCourseInput.value.toLowerCase();
    const teeFilter = filterTeeSelect.value;
    const filtered = allRounds.filter(round => {
      const matchesName = round.name.toLowerCase().includes(nameFilter);
      const matchesCourse = round.course.toLowerCase().includes(courseFilter);
      const matchesTee = teeFilter === "" || round.tee === teeFilter;
      return matchesName && matchesCourse && matchesTee;
    });
    renderRounds(filtered);
  }

  // Add event listeners for filter inputs
  filterNameInput.addEventListener("input", filterRounds);
  filterCourseInput.addEventListener("input", filterRounds);
  filterTeeSelect.addEventListener("change", filterRounds);
  clearFiltersBtn.addEventListener("click", () => {
    filterNameInput.value = "";
    filterCourseInput.value = "";
    filterTeeSelect.value = "";
    renderRounds(allRounds);
  });

  // ---- Code for Adding New Rounds ----
  const newRoundsTable = document.getElementById("newRoundsTable");
  const addRoundsForm = document.getElementById("newRoundsForm");
  const generateBtn = document.getElementById("generateRowsBtn");
  const numRows = document.getElementById("numRows");

  // Generate new input rows for adding rounds
  generateBtn.addEventListener("click", () => {
    const count = parseInt(numRows.value, 10);
    newRoundsTable.querySelector("tbody").innerHTML = "";
    for (let i = 0; i < count; i++) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <!-- Name, Date, Course, Tee with placeholders -->
        <td><input type="text" name="name" placeholder="Name" required></td>
        <td><input type="date" name="date" required></td>
        <td><input type="text" name="course" placeholder="Course" required></td>
        <td>
          <select name="tee" required>
            <option value="Green">Green</option>
            <option value="White">White</option>
            <option value="Blue">Blue</option>
            <option value="Back">Back</option>
          </select>
        </td>
        <!-- Front 9 holes with placeholders -->
        ${Array.from({ length: 9 }, (_, j) => `
          <td><input type="number" class="hole-input" name="hole${j}" min="1" placeholder="${j+1}" required></td>
        `).join("")}
        <!-- F9 cell -->
        <td class="f9-cell sub-total">0</td>
        <!-- Back 9 holes with placeholders -->
        ${Array.from({ length: 9 }, (_, j) => `
          <td><input type="number" class="hole-input" name="hole${j+9}" min="1" placeholder="${j+10}" required></td>
        `).join("")}
        <!-- B9 cell -->
        <td class="b9-cell sub-total">0</td>
        <!-- Total cell -->
        <td class="total-cell">0</td>
      `;
      newRoundsTable.querySelector("tbody").appendChild(row);
      attachCalculationListeners(row);
    }
  });

  // Attach real-time calculation listeners to a new row's hole inputs
  function attachCalculationListeners(row) {
    const holeInputs = row.querySelectorAll(".hole-input");
    const f9Cell = row.querySelector(".f9-cell");
    const b9Cell = row.querySelector(".b9-cell");
    const totalCell = row.querySelector(".total-cell");

    holeInputs.forEach(input => {
      input.addEventListener("input", () => {
        let front9 = 0;
        let back9 = 0;
        holeInputs.forEach((inp, idx) => {
          const val = parseInt(inp.value) || 0;
          if (idx < 9) {
            front9 += val;
          } else {
            back9 += val;
          }
        });
        f9Cell.textContent = front9;
        b9Cell.textContent = back9;
        totalCell.textContent = front9 + back9;
      });
    });
  }

  // Handle form submission to add new rounds
  addRoundsForm.addEventListener("submit", e => {
    e.preventDefault();
    const rows = newRoundsTable.querySelectorAll("tbody tr");
    const newRounds = [];
    rows.forEach(row => {
      const inputs = row.querySelectorAll("input, select");
      const name = inputs[0].value.trim();
      const date = inputs[1].value.trim();
      const course = inputs[2].value.trim();
      const tee = inputs[3].value;
      const holes = Array.from(inputs).slice(4, 22).map(inp => parseInt(inp.value) || 0);
      const front9 = holes.slice(0, 9).reduce((a, b) => a + b, 0);
      const back9 = holes.slice(9).reduce((a, b) => a + b, 0);
      const total = front9 + back9;
      if (!name || !date || !course || holes.includes(0)) return;
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

