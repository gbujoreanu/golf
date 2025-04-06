document.addEventListener("DOMContentLoaded", () => {
    const courseForm = document.getElementById("courseForm");
    const courseMessage = document.getElementById("courseMessage");
    const coursesBody = document.getElementById("coursesBody");
  
    // Fetch existing courses on page load
    function loadExistingCourses() {
      fetch("/courses")
        .then(res => res.json())
        .then(data => {
          coursesBody.innerHTML = "";
          data.forEach(courseObj => {
            // Each courseObj has { course, tees: [ { tee, rating, slope, teeColor }, ... ] }
            courseObj.tees.forEach(t => {
              const row = document.createElement("tr");
              row.innerHTML = `
                <td>${courseObj.course}</td>
                <td>${t.tee}</td>
                <td>${t.rating}</td>
                <td>${t.slope}</td>
                <td>${t.teeColor}</td>
              `;
              coursesBody.appendChild(row);
            });
          });
        })
        .catch(err => {
          console.error("Error fetching courses:", err);
          coursesBody.innerHTML = "<tr><td colspan='5'>Error loading courses</td></tr>";
        });
    }
  
    loadExistingCourses(); // initial load
  
    courseForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = {
        course: document.getElementById("courseName").value.trim(),
        tee: document.getElementById("tee").value.trim(),
        rating: parseFloat(document.getElementById("rating").value),
        slope: parseInt(document.getElementById("slope").value, 10),
        teeColor: document.getElementById("teeColor").value.trim()
      };
  
      fetch("/add-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            courseMessage.textContent = "Course added successfully!";
            courseForm.reset();
            // Reload the table
            loadExistingCourses();
          } else {
            courseMessage.textContent = "Error adding course.";
          }
        })
        .catch(err => {
          console.error("Error adding course:", err);
          courseMessage.textContent = "Server error.";
        });
    });
  });
  