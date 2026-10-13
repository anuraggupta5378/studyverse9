(async () => {
 try {
  const p = await profileOf(user.id);

  const role = String(p?.role || "").toLowerCase();

  const adminLink = document.getElementById("adminLink");
  const staffLink = document.getElementById("staffLink");
  const managerLink = document.getElementById("managerLink");

  if (adminLink) {
    adminLink.classList.toggle("show", role === "admin");
  }

  if (staffLink) {
    staffLink.style.display =
      ["staff", "admin"].includes(role) ? "inline-block" : "none";
  }

  if (managerLink) {
    managerLink.style.display =
      ["manager", "admin"].includes(role) ? "inline-block" : "none";
  }
} catch (e) {
  console.error("Could not load dashboard role:", e);
}
  if (!ctx) return;

  setUserUI(ctx.profile);

  if (["admin", "staff"].includes(ctx.profile.role)) {
    const adminLink = document.getElementById("adminLink");
    const staffLink = document.getElementById("staffLink");

    if (adminLink) adminLink.style.display = "inline-block";
    if (staffLink) staffLink.style.display = "inline-block";
  }

  try {
    const chapters = await fetchChapters();

    const {
      data: cp,
      error: cpe
    } = await sb
      .from("chapter_progress")
      .select("chapter_id, completed")
      .eq("user_id", ctx.user.id);

    if (cpe) throw cpe;

    const done = new Set(
      (cp || [])
        .filter(x => x.completed)
        .map(x => x.chapter_id)
    );

    const resources = await fetchResources();

    const stats = document.getElementById("stats");

    if (stats) {
      stats.innerHTML = [
        ["Chapters", chapters.length],
        ["Completed", done.size],
        ["Resources", resources.length],
        ["Part 2", "Soon"]
      ].map(x => `
        <div class="card">
          <div class="tag">${esc(x[0])}</div>
          <div class="stat">${esc(x[1])}</div>
        </div>
      `).join("");
    }

    const chapterBox = document.getElementById("chapters");

    if (chapterBox) {
      chapterBox.innerHTML = chapters.map(c => `
        <a class="card"
           href="chapter.html?id=${encodeURIComponent(c.id)}">

          <span class="pill">
            Chapter ${esc(c.chapter_number ?? c.display_order)}
          </span>

          <h3>${esc(c.name)}</h3>

          <div class="progress">
            <i style="width:${done.has(c.id) ? 100 : 0}%"></i>
          </div>

          <p class="muted">
            ${done.has(c.id)
              ? "Completed"
              : "Not completed yet"}
          </p>

        </a>
      `).join("");
    }

    const {
      data: ann,
      error: ae
    } = await sb
      .from("announcements")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(5);

    if (ae) throw ae;

    const announcementBox =
      document.getElementById("announcements");

    if (announcementBox) {
      announcementBox.innerHTML =
        (ann || []).map(a => `
          <article class="resource">
            <div>
              <h3>
                ${esc(a.title || "Announcement")}
              </h3>

              <p class="muted">
                ${esc(a.message || a.content || "")}
              </p>
            </div>
          </article>
        `).join("")
        ||
        '<div class="empty">No announcements yet.</div>';
    }

  } catch (e) {
    console.error(e);
    toast(e.message, "error");
  }
})();
