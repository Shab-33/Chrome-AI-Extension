document.getElementById("summariseBtn").addEventListener("click", async () => {
  const output = document.getElementById("output");

  output.textContent = "Summarising...";

  try {
    const summary = await summarisePage();
    output.textContent = summary;
  } catch (err) {
    output.textContent = `Something went wrong: ${err.message}`;
  }
});
