(function () {
  function updateHeader() {
    const isLoggedIn = localStorage.getItem("loggedInUser") === "true";
    const loginLink = document.querySelector(".login-link");
    if (!loginLink) return;

    const menuDropdown = document.querySelector(".menu-dropdown");

    if (isLoggedIn) {
      loginLink.innerHTML = `<img src="images/Profile_Icon_Design.jpg" alt="Profile" class="profile-icon"> Logout`;
      loginLink.href = "#";
      loginLink.onclick = (e) => {
        e.preventDefault();
        localStorage.removeItem("loggedInUser");
        updateHeader();
      };
    } else {
      loginLink.innerHTML = `<img src="images/Profile_Icon_Design.jpg" alt="Profile" class="profile-icon"> Login`;
      loginLink.href = "login.html";
      loginLink.onclick = null;
    }
  }

  // Attach menu toggle safely
  const menuBtn = document.querySelector(".menu-btn");
  if (menuBtn) {
    menuBtn.addEventListener("click", function (e) {
      const dropdown = document.querySelector(".menu-dropdown");
      if (dropdown) {
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
      }
      e.stopPropagation();
    });
  }

  // Expose globally
  window.updateHeader = updateHeader;
})();