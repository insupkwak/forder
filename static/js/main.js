const dz = document.querySelector("#dropzone");
const fileInput = document.querySelector("#fileInput");
const fileList = document.querySelector("#fileList");

function renderFiles(files) {
  if (!fileList) return;
  if (!files || files.length === 0) {
    fileList.textContent = "";
    return;
  }
  const names = Array.from(files).map(f => `${f.name} (${Math.round(f.size / 1024)} KB)`);
  fileList.innerHTML = names.map(n => `<div class="fileitem">${n}</div>`).join("");
}

if (fileInput) {
  fileInput.addEventListener("change", (e) => {
    renderFiles(e.target.files);
  });
}

if (dz && fileInput) {
  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.classList.add("drag");
  });

  dz.addEventListener("dragleave", () => {
    dz.classList.remove("drag");
  });

  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("drag");

    if (e.dataTransfer && e.dataTransfer.files) {
      fileInput.files = e.dataTransfer.files;
      renderFiles(fileInput.files);
    }
  });
}
