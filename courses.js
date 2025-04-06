document.addEventListener("DOMContentLoaded", () => {
    const courseForm = document.getElementById("courseForm");
    const courseMessage = document.getElementById("courseMessage");
  
    courseForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = {
        course: document.getElementById("courseName").value.trim(),
        tee: document.getElementById("tee").value.trim(),
        rating: parseFloat(document.getElementById("rating").value),
        slope: parseInt(document.getElementById("slope").value, 10),
        teeColor: document.getElementById("teeColor").value
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
  