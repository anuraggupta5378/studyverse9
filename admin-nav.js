const NAV = [
  ["admin.html", "Overview"],
  ["admin-users.html", "Users & Roles"],
  ["admin-reviews.html", "Reviews"],
  ["admin-content.html", "Content"],
  ["admin-announcements.html", "Announcements"],
  ["admin-analytics.html", "Analytics"]
];

const nav = document.getElementById("nav");

if (nav) {
  const current =
    location.pathname.split("/").pop() || "admin.html";

  nav.innerHTML = NAV.map(item => `
    <a
      class="${item[0] === current ? "active" : ""}"
      href="${item[0]}"
    >
      ${item[1]}
    </a>
  `).join("");

  document
    .getElementById("menuBtn")
    ?.addEventListener("click", () => {
      nav.classList.toggle("open");
    });
    }
