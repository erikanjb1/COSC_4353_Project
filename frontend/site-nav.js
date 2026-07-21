document.addEventListener("DOMContentLoaded", function () {
    const siteNavigation = document.createElement("nav");
  
    siteNavigation.className = "site-navigation";
  
    siteNavigation.innerHTML = `
      <div class="site-navigation-content">
        <a class="site-logo" href="/">QueueSmart</a>
  
        <div class="site-navigation-links">
          <a href="/" data-page="/">User Portal</a>
          <a href="/admin" data-page="/admin">Admin Portal</a>
          <a href="/login" data-page="/login">Login</a>
          <a href="/register" data-page="/register">Register</a>
        </div>
      </div>
    `;
  
    document.body.prepend(siteNavigation);
  
    let currentPath = window.location.pathname;
  
    if (
      currentPath === "/index.html" ||
      currentPath === ""
    ) {
      currentPath = "/";
    }
  
    if (currentPath === "/admin.html") {
      currentPath = "/admin";
    }
  
    if (currentPath === "/login.html") {
      currentPath = "/login";
    }
  
    if (currentPath === "/register.html") {
      currentPath = "/register";
    }
  
    const links = siteNavigation.querySelectorAll(
      ".site-navigation-links a"
    );
  
    links.forEach(function (link) {
      if (
        link.getAttribute("data-page") === currentPath
      ) {
        link.classList.add("site-link-active");
      }
    });
  });