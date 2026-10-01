let managerResources = [];
let managerReviews = [];

(async function () {

  const access =
    await requireRole([
      "manager",
      "admin"
    ]);

  if (!access) return;

  await loadManager();

})();

async function loadManager() {

  try {

    const [
      resourceResult,
      reviewResult
    ] = await Promise.all([

      fetchResources(),

      sb
        .from("resource_change_requests")
        .select("*")
        .order("created_at", {
          ascending: false
        })
        .limit(30)

    ]);

    if (reviewResult.error)
      throw reviewResult.error;

    managerResources =
      resourceResult || [];

    managerReviews =
      reviewResult.data || [];

    renderManager();

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Manager workspace failed."
    );
  }
}

function renderManager() {

  const pending =
    managerReviews.filter(
      item => item.status === "pending"
    ).length;

  const published =
    managerResources.filter(
      item => item.is_published
    ).length;

  document.getElementById(
    "managerMetrics"
  ).innerHTML = [

    [
      "Resources",
      managerResources.length,
      "Catalogue"
    ],

    [
      "Pending reviews",
      pending,
      "Staff workflow"
    ],

    [
      "Published",
      published,
      "Live now"
    ],

    [
      "Drafts",
      managerResources.length -
      published,
      "Not live"
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

  const reviewEl =
    document.getElementById(
      "managerReviews"
    );

  const pendingRows =
    managerReviews
      .filter(item =>
        item.status === "pending"
      )
      .slice(0, 8);

  reviewEl.innerHTML =
    pendingRows.length
      ? pendingRows.map(item => `
          <div class="row">

            <div>
              <div class="rowtitle">
                ${esc(
                  item.title ||
                  "Untitled resource"
                )}
              </div>

              <div class="rowsub">
                ${esc(item.action)}
                ·
                ${new Date(
                  item.created_at
                ).toLocaleDateString()}
              </div>
            </div>

            <a
              class="btn small"
              href="admin-reviews.html"
            >
              Review
            </a>

          </div>
        `).join("")
      : `<div class="empty">
          No pending reviews.
        </div>`;

  document.getElementById(
    "managerResources"
  ).innerHTML =
    managerResources
      .slice(0, 8)
      .map(item => `
        <div class="row">

          <div>
            <div class="rowtitle">
              ${esc(item.title)}
            </div>

            <div class="rowsub">
              ${esc(item.resource_type)}
            </div>
          </div>

          <span class="badge ${
            item.is_published
              ? "good"
              : "warn"
          }">
            ${
              item.is_published
                ? "Live"
                : "Draft"
            }
          </span>

        </div>
      `).join("");
}

function openManagerResource() {

  document.getElementById(
    "managerModal"
  ).classList.add("show");

  document.getElementById("mTitle").value = "";
  document.getElementById("mChapter").value = "";
  document.getElementById("mDesc").value = "";
}

function closeManagerModal() {

  document.getElementById(
    "managerModal"
  ).classList.remove("show");
}

async function saveManagerResource() {

  try {

    const user =
      await currentUser();

    const { error } =
      await sb
        .from("resources")
        .insert({

          title:
            document.getElementById(
              "mTitle"
            ).value.trim(),

          chapter_id:
            document.getElementById(
              "mChapter"
            ).value.trim(),

          resource_type:
            document.getElementById(
              "mType"
            ).value,

          description:
            document.getElementById(
              "mDesc"
            ).value,

          created_by: user.id,
          updated_by: user.id,
          is_published: true
        });

    if (error) throw error;

    closeManagerModal();

    toast(
      "Resource published successfully."
    );

    await loadManager();

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Could not publish resource."
    );
  }
                }
