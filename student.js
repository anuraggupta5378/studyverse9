(async () => {
  try {
    // Authenticate the user and allow the supported roles.
    const ctx = await requireRole([
      "student",
      "staff",
      "manager",
      "admin"
    ]);

    if (!ctx) return;

    // Set the signed-in user's information.
    setUserUI(ctx.profile);

    // Load chapters.
    const chapters = await fetchChapters();

    // Load this user's chapter progress.
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
        .filter(item => item.completed)
        .map(item => item.chapter_id)
    );

    // Load published resources using the existing app.js function.
    const resources = await fetchResources();

    // Update dashboard statistics.
    const stats = document.getElementById("stats");

    if (stats) {
      stats.innerHTML = [
        ["Chapters", chapters.length],
        ["Completed", done.size],
        ["Resources", resources.length],
        ["Part 2", "Soon"]
      ]
        .map(item => `
          <div class="card">
            <div class="tag">${esc(item[0])}</div>
            <div class="stat">${esc(item[1])}</div>
          </div>
        `)
        .join("");
    }

    // Display chapters and completion status.
    const chapterBox = document.getElementById("chapters");

    if (chapterBox) {
      chapterBox.innerHTML = chapters
        .map(chapter => {
          const completed = done.has(chapter.id);

          return `
            <a class="card"
               href="chapter.html?id=${encodeURIComponent(chapter.id)}">

              <span class="pill">
                Chapter ${esc(
                  chapter.chapter_number ?? chapter.display_order ?? ""
                )}
              </span>

              <h3>${esc(chapter.name || chapter.title || "Chapter")}</h3>

              <div class="progress">
                <i style="width:${completed ? 100 : 0}%"></i>
              </div>

              <p class="muted">
                ${completed ? "Completed" : "Not completed yet"}
              </p>

            </a>
          `;
        })
        .join("");
    }

    // Load published announcements.
    const {
      data: announcements,
      error: announcementError
    } = await sb
      .from("announcements")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(5);

    if (announcementError) throw announcementError;

    // Display announcements.
    const announcementBox =
      document.getElementById("announcements");

    if (announcementBox) {
      announcementBox.innerHTML =
        (announcements || [])
          .map(announcement => `
            <article class="resource">
              <div>
                <h3>
                  ${esc(announcement.title || "Announcement")}
                </h3>

                <p class="muted">
                  ${esc(
                    announcement.message ||
                    announcement.content ||
                    ""
                  )}
                </p>
              </div>
            </article>
          `)
          .join("")
        || '<div class="empty">No announcements yet.</div>';
    }

  } catch (error) {
    console.error("Student dashboard error:", error);

    if (typeof toast === "function") {
      toast(
        error?.message || "Could not load dashboard content.",
        "error"
      );
    }
  }
})();
