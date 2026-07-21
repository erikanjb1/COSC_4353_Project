function ensureToastContainer() {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    document.body.appendChild(container);
  }

  return container;
}

function showToast(message, type) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  const toastType = type || "info";

  toast.className = "toast toast_" + toastType;
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(function () {
    toast.classList.add("show");
  });

  setTimeout(function () {
    toast.classList.remove("show");

    setTimeout(function () {
      toast.remove();
    }, 250);
  }, 2800);
}
