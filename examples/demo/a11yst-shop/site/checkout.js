function wireHelpDialog() {
  const openButton = document.getElementById("open-help");
  const dialog = document.getElementById("help-dialog");
  const closeButton = document.getElementById("close-help");
  if (!openButton || !dialog || !closeButton) {
    return;
  }

  openButton.addEventListener("click", () => {
    dialog.hidden = false;
    closeButton.focus();
  });

  closeButton.addEventListener("click", () => {
    dialog.hidden = true;
    openButton.focus();
  });
}

document.addEventListener("DOMContentLoaded", wireHelpDialog);
