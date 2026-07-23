(function () {
  if (window.location.protocol === "file:") {
    var warning = document.createElement("div");
    warning.className = "protocol-warning";
    warning.innerHTML = "This dashboard is running from a local file. To load embedded tools, run <strong>powershell -ExecutionPolicy Bypass -File .\\serve.ps1</strong> in the project folder, then open <strong>http://localhost:4173</strong>.";
    document.body.prepend(warning);
  }

  var menuToggle = document.getElementById("menuToggle");
  var sidebar = document.getElementById("sidebar");
  var yearStamp = document.getElementById("yearStamp");

  if (yearStamp) {
    yearStamp.textContent = String(new Date().getFullYear());
  }

  if (!menuToggle || !sidebar) {
    return;
  }

  menuToggle.addEventListener("click", function () {
    var expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    var clickedInside = sidebar.contains(target) || menuToggle.contains(target);
    if (!clickedInside && sidebar.classList.contains("open")) {
      sidebar.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
})();
