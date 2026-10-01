(async function () {

  const access =
    await requireRole(["admin"]);

  if (!access) return;

  await loadAnalytics();

})();

async function loadAnalytics() {

  try {

    const [
      visitsToday,
      totalVisits,
      totalUsers,
      newUsers,
      staffTime,
      managerTime
    ] = await Promise.all([

      sb.rpc("admin_visits_today"),

      sb.rpc("admin_total_visits"),

      sb.rpc("admin_total_registered"),

      sb.rpc(
        "admin_new_registrations_today"
      ),

      sb.rpc(
        "admin_staff_active_seconds_today"
      ),

      sb.rpc(
        "admin_manager_active_seconds_today"
      )
    ]);

    const results = [
      visitsToday,
      totalVisits,
      totalUsers,
      newUsers,
      staffTime,
      managerTime
    ];

    for (const result of results) {
      if (result.error) {
        throw result.error;
      }
    }

    const minutes =
      seconds =>
        `${Math.floor(
          Number(seconds || 0) / 60
        )}m`;

    document.getElementById(
      "analytics"
    ).innerHTML = [

      [
        "Visits today",
        visitsToday.data,
        "Site activity"
      ],

      [
        "Total visits",
        totalVisits.data,
        "Recorded events"
      ],

      [
        "Registered users",
        totalUsers.data,
        "Accounts"
      ],

      [
        "New registrations",
        newUsers.data,
        "Today"
      ],

      [
        "Staff active time",
        minutes(staffTime.data),
        "Today"
      ],

      [
        "Manager active time",
        minutes(managerTime.data),
        "Today"
      ]

    ].map(item => `
      <div class="card">

        <div class="metric-label">
          ${item[0]}
        </div>

        <div class="metric-value">
          ${item[1]}
        </div>

        <div class="metric-note">
          ${item[2]}
        </div>

      </div>
    `).join("");

    document.getElementById(
      "lastRefresh"
    ).textContent =
      `Updated ${new Date().toLocaleString()}`;

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Analytics could not be loaded."
    );
  }
}
