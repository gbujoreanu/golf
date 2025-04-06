document.addEventListener("DOMContentLoaded", () => {
  const scorecardBody = document.getElementById("scorecardBody");
  const newRoundsTable = document.getElementById("newRoundsTable");
  const addRoundsForm = document.getElementById("newRoundsForm");
  const generateBtn = document.getElementById("generateRowsBtn");
  const numRows = document.getElementById("numRows");

  // Load and render existing rounds from JSON
  fetch("scores_data_final.json")
    .then(res => res.json())
    .then(data => {
      scorecardBody.innerHTML = "";
      data.forEach(entry => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${entry.name}</td>
          ${entry.holes.slice(0, 9).map(score => `<td>${score}</td>`).join("")}
          <td class="sub-total">${entry.front9}</td>
          ${entry.holes.slice(9, 18).map(score => `<td>${score}</td>`).join("")}
          <td class="sub-total">${entry.back9}</td>
          <td class="total-cell">${entry.total}</td>
          <td>${entry.date}</td>
          <td>${entry.course}</td>
          <td>${entry.tee}</td>
        `;
        scorecardBody.appendChild(row);
      });

      // Attach filter functionality
      applyFilterLogic();
    });

  generateBtn.addEventListener("click", () => {
    const count = parseInt(numRows.value, 10);
    const tbody = newRoundsTable.querySelector("tbody");
    tbody.innerHTML = "";

    for (let i = 0; i < count; i++) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="text" name="name" required></td>
        <td><input type="date" name="date" required></td>
        <td><input type="text" name="course" required></td>
        <td><select name="tee" required>
          <option value="Green">Green</option>
          <option value="White">White</option>
          <option value="Blue">Blue</option>
          <option value="Back">Back</option>
        </select></td>
        ${Array.from({ length: 9 }, (_, j) => `<td><input type="number" class="hole-input" name="hole${j}" min="1" required></td>`).join("")}
        <td class="f9-cell sub-total">0</td>
        ${Array.from({ length: 9 }, (_, j) => `<td><input type="number" class="hole-input" name="hole${j+9}" min="1" required></td>`).join("")}
        <td class="b9-cell sub-total">0</td>
        <td class="total-cell">0</td>
      `;
      tbody.appendChild(row);
      attachCalculationListeners(row);
    }
  });

  function attachCalculationListeners(row) {
    const inputs = row.querySelectorAll(".hole-input");
    const f9Cell = row.querySelector(".f9-cell");
    const b9Cell = row.querySelector(".b9-cell");
    const totalCell = row.querySelector(".total-cell");

    inputs.forEach(() => {
      inputs.forEach(input => input.addEventListener("input", () => {
        let front9 = 0, back9 = 0;
        inputs.forEach((el, i) => {
          const val = parseInt(el.value) || 0;
          if (i < 9) front9 += val;
          else back9 += val;
        });
        f9Cell.textContent = front9;
        b9Cell.textContent = back9;
        totalCell.textContent = front9 + back9;
      }));
    });
  }

  addRoundsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const rows = newRoundsTable.querySelectorAll("tbody tr");
    const newRounds = [];

    rows.forEach(row => {
      const inputs = row.querySelectorAll("input, select");
      const name = inputs[0].value.trim();
      const date = inputs[1].value.trim();
      const course = inputs[2].value.trim();
      const tee = inputs[3].value;
      const holes = Array.from(inputs).slice(4, 22).map(input => parseInt(input.value) || 0);

      const front9 = holes.slice(0, 9).reduce((a, b) => a + b, 0);
      const back9 = holes.slice(9).reduce((a, b) => a + b, 0);
      const total = front9 + back9;

      if (!name || !date || !course || holes.includes(0)) return;

      newRounds.push({ name, date, course, tee, holes, front9, back9, total });
    });

    if (!newRounds.length) return alert("Please complete all fields correctly.");

    fetch("/add-rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRounds)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) location.reload();
        else alert("Failed to save rounds.");
      })
      .catch(err => {
        console.error("Error:", err);
        alert("Server error while saving.");
      });
  });

  // 🟢 FILTER FUNCTIONALITY
  function applyFilterLogic() {
    const filterName = document.getElementById("filterName");
    const filterCourse = document.getElementById("filterCourse");
    const filterTee = document.getElementById("filterTee");
    const clearFiltersBtn = document.getElementById("clearFiltersBtn");

    function applyFilters() {
      const nameVal = filterName.value.toLowerCase();
      const courseVal = filterCourse.value.toLowerCase();
      const teeVal = filterTee.value.toLowerCase();

      const rows = document.querySelectorAll("#scorecardBody tr");
      rows.forEach(row => {
        const nameCell = row.children[0];
        const courseCell = row.children[row.children.length - 2];
        const teeCell = row.children[row.children.length - 1];

        const matchesName = nameCell.textContent.toLowerCase().includes(nameVal);
        const matchesCourse = courseCell.textContent.toLowerCase().includes(courseVal);
        const matchesTee = teeVal === "" || teeCell.textContent.toLowerCase() === teeVal;

        if (matchesName && matchesCourse && matchesTee) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    }

    [filterName, filterCourse, filterTee].forEach(input =>
      input.addEventListener("input", applyFilters)
    );

    clearFiltersBtn.addEventListener("click", () => {
      filterName.value = "";
      filterCourse.value = "";
      filterTee.value = "";
      applyFilters();
    });
  }
});
