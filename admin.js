(async function () {
  const access = await requireRole(["admin"]);
  if (!access) return;

  try {
    const [
      visitsToday,
      totalVisits,
      totalUsers,
      newUsers,
      staffSeconds,
      managerSeconds,
      chapters,
      resources,
      reviews
    ] = await Promise.all([
      sb.rpc("admin_visits_today"),
      sb.rpc("admin_total_visits"),
      sb.rpc("admin_total_registered"),
      sb.rpc("admin_new_registrations_today"),
      sb.rpc("admin_staff_active_seconds_today"),
      sb.rpc("admin_manager_active_seconds_today"),
      fetchAllChapters(),
      fetchResources(),
      sb
        .from("resource_change_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    ]);

    if (visitsToday.error) throw visitsToday.error;
    if (totalVisits.error) throw totalVisits.error;
    if (totalUsers.error) throw totalUsers.error;
    if (newUsers.error) throw newUsers.error;
    if (staffSeconds.error) throw staffSeconds.error;
    if (managerSeconds.error) throw managerSeconds.error;
    if (reviews.error) throw reviews.error;

    const pending = reviews.data || [];

    const minutes = seconds =>
      `${Math.floor(Number(seconds || 0) / 60)}m`;

    document.getElementById("metrics").innerHTML = [
      ["Registered users", totalUsers.data, "Accounts"],
      ["New today", newUsers.data, "Today"],
      ["Visits today", visitsToday.data, "Site visits"],
      ["Total visits", totalVisits.data, "All recorded visits"],
      ["Staff active", minutes(staffSeconds.data), "Today"],
      ["Manager active", minutes(managerSeconds.data), "Today"],
      [
        "Published resources",
        resources.filter(r => r.is_published).length,
        "Live resources"
      ],
      [
        "Published chapters",
        chapters.filter(c => c.is_published).length,
        "Live chapters"
      ]
    ].map(item => `
      <div class="card">
        <div class="metric-label">${item[0]}</div>
        <div class="metric-value">${item[1]}</div>
        <div class="metric-note">${item[2]}</div>
      </div>
    `).join("");

    const attention =
      pending.length === 0
        ? `<div class="empty">Nothing needs attention right now.</div>`
        : pending.map(r => `
          <div class="row">
            <div>
              <div class="rowtitle">
                ${esc(r.title || "Untitled resource")}
              </div>
              <div class="rowsub">
                ${esc(r.action)} ·
                ${new Date(r.created_at).toLocaleString()}
              </div>
            </div>

            <a
              class="btn small"
              href="admin-reviews.html"
            >
              Review
            </a>
          </div>
        `).join("");

    document.getElementById("attention").innerHTML = attention;

  } catch (error) {
    console.error(error);
    toast(error.message || "Could not load admin overview.");
  }
})();
