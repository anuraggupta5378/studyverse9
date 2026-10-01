let reviewRows = [];
let activeReview = null;

(async function () {
  const access = await requireRole(["admin"]);
  if (!access) return;

  document
    .getElementById("statusFilter")
    .addEventListener("change", loadReviews);

  document
    .getElementById("refreshReviews")
    .addEventListener("click", loadReviews);

  await loadReviews();
})();

async function loadReviews() {
  try {
    const status =
      document.getElementById("statusFilter").value;

    let query = sb
      .from("resource_change_requests")
      .select("*")
      .order("created_at", {
        ascending: false
      });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } =
      await query.limit(100);

    if (error) throw error;

    reviewRows = data || [];

    renderReviews();

  } catch (error) {
    console.error(error);
    toast(error.message || "Could not load reviews.");
  }
}

function renderReviews() {
  const el =
    document.getElementById("reviewList");

  if (!reviewRows.length) {
    el.innerHTML = `
      <div class="empty">
        No review requests here.
      </div>
    `;
    return;
  }

  el.innerHTML = reviewRows.map(request => `
    <div class="row">

      <div>
        <div class="rowtitle">
          ${esc(request.title || "Untitled resource")}
        </div>

        <div class="rowsub">
          ${esc(request.action)}
          ·
          ${new Date(request.created_at).toLocaleString()}
        </div>
      </div>

      <div class="actions">
        <span class="badge ${
          request.status === "pending"
            ? "warn"
            : request.status === "approved"
              ? "good"
              : "bad"
        }">
          ${esc(request.status)}
        </span>

        ${
          request.status === "pending"
            ? `
              <button
                class="btn small"
                onclick="openReview('${request.id}')"
              >
                Review
              </button>
            `
            : ""
        }
      </div>

    </div>
  `).join("");
}

function openReview(id) {
  activeReview =
    reviewRows.find(row => row.id === id);

  if (!activeReview) return;

  document.getElementById("reviewBody").innerHTML = `
    <h3>
      ${esc(activeReview.title || "Untitled resource")}
    </h3>

    <p class="muted">
      ${esc(activeReview.description || "No description")}
    </p>

    <div class="rowsub">
      Action: ${esc(activeReview.action)}
    </div>
  `;

  document.getElementById("reviewNote").value = "";

  document
    .getElementById("reviewModal")
    .classList.add("show");
}

function closeReview() {
  document
    .getElementById("reviewModal")
    .classList.remove("show");

  activeReview = null;
}

async function finishReview(status) {
  if (!activeReview) return;

  try {
    const user = await currentUser();

    const note =
      document.getElementById("reviewNote")
        .value
        .trim();

    if (status === "approved") {

      if (activeReview.action === "delete") {

        const { error } =
          await sb
            .from("resources")
            .delete()
            .eq("id", activeReview.resource_id);

        if (error) throw error;

      } else {

        const patch = {
          title: activeReview.title,
          resource_type: activeReview.resource_type,
          description: activeReview.description,
          content: activeReview.content,
          file_path: activeReview.file_path,
          external_url: activeReview.external_url,
          chapter_id: activeReview.chapter_id,
          is_published: true,
          updated_by: user.id
        };

        const { error } =
          await sb
            .from("resources")
            .update(patch)
            .eq("id", activeReview.resource_id);

        if (error) throw error;
      }
    }

    const { error } =
      await sb
        .from("resource_change_requests")
        .update({
          status,
          reviewed_by: user.id,
          review_note: note,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", activeReview.id);

    if (error) throw error;

    closeReview();

    toast(
      status === "approved"
        ? "Resource approved and published."
        : "Resource request rejected."
    );

    await loadReviews();

  } catch (error) {
    console.error(error);
    toast(error.message || "Review action failed.");
  }
  }
