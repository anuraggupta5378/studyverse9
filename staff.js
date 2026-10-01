let staffResources = [];
let staffReviews = [];

(async function () {

  const access =
    await requireRole([
      "staff",
      "admin"
    ]);

  if (!access) return;

  await loadStaff();

})();

async function loadStaff() {

  try {

    const user =
      await currentUser();

    const [
      resourceResult,
      reviewResult
    ] = await Promise.all([

      sb
        .from("resources")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", {
          ascending: false
        }),

      sb
        .from("resource_change_requests")
        .select("*")
        .eq("submitted_by", user.id)
        .order("created_at", {
          ascending: false
        })
    ]);

    if (resourceResult.error)
      throw resourceResult.error;

    if (reviewResult.error)
      throw reviewResult.error;

    staffResources =
      resourceResult.data || [];

    staffReviews =
      reviewResult.data || [];

    renderStaff();

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Staff workspace failed."
    );
  }
}

function renderStaff() {

  const pending =
    staffReviews.filter(
      item => item.status === "pending"
    ).length;

  const approved =
    staffReviews.filter(
      item => item.status === "approved"
    ).length;

  const rejected =
    staffReviews.filter(
      item => item.status === "rejected"
    ).length;

  document.getElementById(
    "staffMetrics"
  ).innerHTML = [

    [
      "My resources",
      staffResources.length,
      "Created by you"
    ],

    [
      "Pending",
      pending,
      "Awaiting manager"
    ],

    [
      "Approved",
      approved,
      "Accepted work"
    ],

    [
      "Rejected",
      rejected,
      "Needs revision"
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
    "staffResources"
  ).innerHTML =
    staffResources.length
      ? staffResources.map(item => `
          <div class="row">

            <div>
              <div class="rowtitle">
                ${esc(item.title)}
              </div>

              <div class="rowsub">
                ${esc(item.resource_type)}
              </div>
            </div>

            <div class="actions">

              ${
                item.is_published
                  ? `
                    <span class="badge good">
                      Published
                    </span>
                  `
                  : `
                    <button
                      class="btn small"
                      onclick="submitDraft('${item.id}')"
                    >
                      Submit for review
                    </button>
                  `
              }

            </div>

          </div>
        `).join("")
      : `<div class="empty">
          No resources yet.
        </div>`;

  document.getElementById(
    "staffReviews"
  ).innerHTML =
    staffReviews.length
      ? staffReviews.map(item => `
          <div class="row">

            <div>
              <div class="rowtitle">
                ${esc(
                  item.title ||
                  "Untitled"
                )}
              </div>

              <div class="rowsub">
                ${esc(item.action)}
                ·
                ${new Date(
                  item.created_at
                ).toLocaleDateString()}

                ${
                  item.review_note
                    ? ` · ${esc(
                        item.review_note
                      )}`
                    : ""
                }
              </div>
            </div>

            <span class="badge ${
              item.status === "approved"
                ? "good"
                : item.status === "rejected"
                  ? "bad"
                  : "warn"
            }">
              ${esc(item.status)}
            </span>

          </div>
        `).join("")
      : `<div class="empty">
          No submissions yet.
        </div>`;
}

function openStaffResource() {

  document.getElementById(
    "staffModal"
  ).classList.add("show");

  document.getElementById("sTitle").value = "";
  document.getElementById("sChapter").value = "";
  document.getElementById("sDesc").value = "";
  document.getElementById("sUrl").value = "";
}

function closeStaffModal() {

  document.getElementById(
    "staffModal"
  ).classList.remove("show");
}

async function saveStaffDraft() {

  try {

    const user =
      await currentUser();

    const { error } =
      await sb
        .from("resources")
        .insert({

          title:
            document.getElementById(
              "sTitle"
            ).value.trim(),

          chapter_id:
            document.getElementById(
              "sChapter"
            ).value.trim(),

          resource_type:
            document.getElementById(
              "sType"
            ).value,

          description:
            document.getElementById(
              "sDesc"
            ).value,

          external_url:
            document.getElementById(
              "sUrl"
            ).value.trim(),

          created_by: user.id,
          updated_by: user.id,
          is_published: false
        });

    if (error) throw error;

    closeStaffModal();

    toast("Draft saved.");

    await loadStaff();

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Could not save draft."
    );
  }
}

async function submitDraft(id) {

  try {

    const user =
      await currentUser();

    const resource =
      staffResources.find(
        item => item.id === id
      );

    if (!resource) return;

    const { error } =
      await sb
        .from("resource_change_requests")
        .insert({

          resource_id: resource.id,

          submitted_by: user.id,

          action: "create",

          title: resource.title,

          resource_type:
            resource.resource_type,

          description:
            resource.description,

          content:
            resource.content,

          file_path:
            resource.file_path,

          external_url:
            resource.external_url,

          chapter_id:
            resource.chapter_id,

          status: "pending"
        });

    if (error) throw error;

    toast(
      "Draft sent for manager review."
    );

    await loadStaff();

  } catch (error) {

    console.error(error);

    toast(
      error.message ||
      "Could not submit draft."
    );
  }
}
