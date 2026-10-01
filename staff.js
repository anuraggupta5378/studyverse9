/* StudyVerse 9 — Staff Workspace */

let staffCtx = null;
let staffResources = [];
let staffReviews = [];
let staffAccess = null;

/* -----------------------------
   Small helpers
----------------------------- */

function staffEsc(value = "") {
  return String(value).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function staffToast(message, type = "ok") {
  if (typeof toast === "function") {
    toast(message, type);
  }
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return value;
  }
}

function resourceLabel(resource) {
  return (
    resource.title ||
    resource.name ||
    "Untitled resource"
  );
}

function resourceKind(resource) {
  return (
    resource.resource_type ||
    resource.type ||
    "resource"
  );
}

/* -----------------------------
   Page navigation
----------------------------- */

function openStudentView() {
  location.href = "dashboard.html";
}

function openResourceCreator() {
  showResourceModal();
}

/* -----------------------------
   Initialisation
----------------------------- */

async function initStaff() {
  try {
    staffCtx = await requireRole(["staff", "admin"]);

    if (!staffCtx) return;

    document.getElementById("staffName").textContent =
      staffCtx.profile?.full_name || "Staff Member";

    /*
      Admins can inspect the staff workspace too.
      Normal staff users won't see this link.
    */
    if (staffCtx.profile?.role === "admin") {
      const adminLink = document.getElementById("adminLink");

      if (adminLink) {
        adminLink.style.display = "";
      }
    }

    await Promise.all([
      loadStaffAccess(),
      loadStaffResources(),
      loadStaffReviews()
    ]);

    renderAllStaff();
  } catch (error) {
    console.error("Staff workspace error:", error);

    staffToast(
      error?.message || "Unable to load staff workspace.",
      "error"
    );
  }
}

/* -----------------------------
   Staff permissions
----------------------------- */

async function loadStaffAccess() {
  const { data, error } = await sb
    .from("staff_access")
    .select("*")
    .eq("user_id", staffCtx.user.id)
    .maybeSingle();

  if (error) throw error;

  staffAccess = data || {
    can_manage_content: false,
    can_publish: false,
    can_manage_students: false,
    can_manage_announcements: false
  };
}

/* -----------------------------
   Staff resources
----------------------------- */

async function loadStaffResources() {
  const { data, error } = await sb
    .from("resources")
    .select("*")
    .eq("created_by", staffCtx.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  staffResources = data || [];
}

/* -----------------------------
   Review requests
----------------------------- */

async function loadStaffReviews() {
  const { data, error } = await sb
    .from("resource_change_requests")
    .select("*")
    .eq("submitted_by", staffCtx.user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  staffReviews = data || [];
}

/* -----------------------------
   Render everything
----------------------------- */

function renderAllStaff() {
  renderStats();
  renderResources();
  renderReviews();
  renderPermissions();
}

/* -----------------------------
   Statistics
----------------------------- */

function renderStats() {
  const total = staffResources.length;

  const pending = staffReviews.filter(
    r => r.status === "pending"
  ).length;

  const approved = staffReviews.filter(
    r => r.status === "approved"
  ).length;

  const rejected = staffReviews.filter(
    r => r.status === "rejected"
  ).length;

  document.getElementById("myResourceCount").textContent = total;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("approvedCount").textContent = approved;
  document.getElementById("rejectedCount").textContent = rejected;
}

/* -----------------------------
   Resource table
----------------------------- */

function renderResources() {
  const box = document.getElementById("resourceWorkspace");

  if (!box) return;

  if (!staffResources.length) {
    box.innerHTML = `
      <div class="empty-state">
        <strong>No resources yet.</strong>
        <br>
        Add your first learning resource to begin.
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Resource</th>
          <th>Type</th>
          <th>Published</th>
          <th>Created</th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        ${staffResources.map(resource => {

          const published = !!resource.is_published;

          return `
            <tr>

              <td>
                <strong>
                  ${staffEsc(resourceLabel(resource))}
                </strong>
              </td>

              <td>
                ${staffEsc(resourceKind(resource))}
              </td>

              <td>
                <span class="status ${published ? "approved" : "pending"}">
                  ${published ? "Published" : "Draft"}
                </span>
              </td>

              <td>
                ${staffEsc(formatDate(resource.created_at))}
              </td>

              <td>

                ${
                  published
                    ? `
                      <button
                        class="btn small"
                        onclick="requestResourceUpdate('${resource.id}')"
                      >
                        Request change
                      </button>
                    `
                    : `
                      <button
                        class="btn small"
                        onclick="editStaffResource('${resource.id}')"
                      >
                        Edit
                      </button>

                      <button
                        class="btn small"
                        onclick="submitResourceForReview('${resource.id}')"
                      >
                        Submit
                      </button>
                    `
                }

              </td>

            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

/* -----------------------------
   Review table
----------------------------- */

function renderReviews() {
  const box = document.getElementById("reviewWorkspace");

  if (!box) return;

  if (!staffReviews.length) {
    box.innerHTML = `
      <div class="empty-state">
        No review requests yet.
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Action</th>
          <th>Resource</th>
          <th>Status</th>
          <th>Submitted</th>
          <th>Review note</th>
        </tr>
      </thead>

      <tbody>
        ${staffReviews.map(review => {

          const resource =
            staffResources.find(
              r => r.id === review.resource_id
            );

          const title =
            review.title ||
            resource?.title ||
            "Resource";

          const status =
            review.status || "pending";

          return `
            <tr>

              <td>
                ${staffEsc(review.action || "update")}
              </td>

              <td>
                <strong>
                  ${staffEsc(title)}
                </strong>
              </td>

              <td>
                <span class="status ${staffEsc(status)}">
                  ${staffEsc(status)}
                </span>
              </td>

              <td>
                ${staffEsc(formatDate(review.created_at))}
              </td>

              <td>
                ${staffEsc(review.review_note || "—")}
              </td>

            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

/* -----------------------------
   Permissions
----------------------------- */

function renderPermissions() {
  const box = document.getElementById("permissionWorkspace");

  if (!box) return;

  const permissions = [
    [
      "Manage content",
      staffAccess?.can_manage_content
    ],
    [
      "Publish",
      staffAccess?.can_publish
    ],
    [
      "Manage students",
      staffAccess?.can_manage_students
    ],
    [
      "Announcements",
      staffAccess?.can_manage_announcements
    ]
  ];

  box.innerHTML = permissions.map(([name, enabled]) => `
    <div class="permission">

      <strong>
        ${enabled ? "✓" : "—"}
        ${staffEsc(name)}
      </strong>

      <span>
        ${enabled ? "Permission enabled" : "Permission not granted"}
      </span>

    </div>
  `).join("");
}

/* -----------------------------
   Resource modal
----------------------------- */

function showResourceModal(resource = null) {
  const modal = document.getElementById("resourceModal");
  const body = document.getElementById("resourceModalBody");

  if (!modal || !body) return;

  const editing = !!resource;

  body.innerHTML = `
    <div class="actions" style="justify-content:space-between">
      <h2>
        ${editing ? "Edit Resource" : "Add Resource"}
      </h2>

      <button
        class="btn small"
        onclick="closeResourceModal()"
      >
        Close
      </button>
    </div>

    <form
      id="staffResourceForm"
      style="margin-top:18px"
    >

      <label>
        Title
        <input
          id="staffResourceTitle"
          required
          value="${staffEsc(resource?.title || "")}"
          placeholder="Resource title"
        >
      </label>

      <label>
        Resource type
        <select id="staffResourceType">

          ${[
            "notes",
            "solutions",
            "exercise",
            "important",
            "video",
            "practice",
            "pdf",
            "book",
            "other"
          ].map(type => `
            <option
              value="${type}"
              ${resource?.resource_type === type ? "selected" : ""}
            >
              ${type}
            </option>
          `).join("")}

        </select>
      </label>

      <label>
        Chapter ID
        <input
          id="staffResourceChapter"
          required
          value="${staffEsc(resource?.chapter_id || "")}"
          placeholder="Chapter UUID"
        >
      </label>

      <label>
        Description
        <textarea
          id="staffResourceDescription"
          rows="4"
          placeholder="Short description"
        >${staffEsc(resource?.description || "")}</textarea>
      </label>

      <label>
        Content
        <textarea
          id="staffResourceContent"
          rows="8"
          placeholder="Learning content"
        >${staffEsc(resource?.content || "")}</textarea>
      </label>

      <label>
        External URL
        <input
          id="staffResourceUrl"
          type="url"
          value="${staffEsc(resource?.external_url || "")}"
          placeholder="https://..."
        >
      </label>

      <div class="actions" style="margin-top:18px">

        <button
          type="submit"
          class="btn"
        >
          ${editing ? "Save Draft" : "Create Draft"}
        </button>

        <button
          type="button"
          class="btn secondary"
          onclick="closeResourceModal()"
        >
          Cancel
        </button>

      </div>

    </form>
  `;

  modal.style.display = "flex";

  document
    .getElementById("staffResourceForm")
    .addEventListener(
      "submit",
      event => saveStaffResource(event, resource)
    );
}

function closeResourceModal() {
  const modal = document.getElementById("resourceModal");

  if (modal) {
    modal.style.display = "none";
  }
}

/* -----------------------------
   Save draft
----------------------------- */

async function saveStaffResource(event, existingResource = null) {
  event.preventDefault();

  if (!staffCtx) return;

  const title =
    document.getElementById("staffResourceTitle").value.trim();

  const resourceType =
    document.getElementById("staffResourceType").value;

  const chapterId =
    document.getElementById("staffResourceChapter").value.trim();

  const description =
    document.getElementById("staffResourceDescription").value.trim();

  const content =
    document.getElementById("staffResourceContent").value.trim();

  const externalUrl =
    document.getElementById("staffResourceUrl").value.trim();

  if (!title || !chapterId) {
    staffToast(
      "Title and Chapter ID are required.",
      "error"
    );
    return;
  }

  const payload = {
    chapter_id: chapterId,
    title,
    resource_type: resourceType,
    description: description || null,
    content: content || null,
    external_url: externalUrl || null,
    is_published: false,
    updated_by: staffCtx.user.id
  };

  try {

    if (existingResource) {

      const { error } = await sb
        .from("resources")
        .update(payload)
        .eq("id", existingResource.id);

      if (error) throw error;

      staffToast("Draft updated.");

    } else {

      const { error } = await sb
        .from("resources")
        .insert({
          ...payload,
          created_by: staffCtx.user.id
        });

      if (error) throw error;

      staffToast("Draft created.");

    }

    closeResourceModal();

    await refreshStaff();

  } catch (error) {

    console.error(error);

    staffToast(
      error?.message || "Could not save resource.",
      "error"
    );
  }
}

/* -----------------------------
   Edit draft
----------------------------- */

function editStaffResource(resourceId) {
  const resource = staffResources.find(
    r => r.id === resourceId
  );

  if (!resource) {
    staffToast("Resource not found.", "error");
    return;
  }

  showResourceModal(resource);
}

/* -----------------------------
   Submit draft for review
----------------------------- */

async function submitResourceForReview(resourceId) {
  const resource = staffResources.find(
    r => r.id === resourceId
  );

  if (!resource) {
    staffToast("Resource not found.", "error");
    return;
  }

  if (resource.is_published) {
    staffToast(
      "Published resources require a change request.",
      "error"
    );
    return;
  }

  try {

    const { error } = await sb
      .from("resource_change_requests")
      .insert({
        resource_id: resource.id,
        submitted_by: staffCtx.user.id,
        action: "create",
        title: resource.title,
        resource_type: resource.resource_type,
        description: resource.description,
        content: resource.content,
        file_path: resource.file_path,
        external_url: resource.external_url,
        chapter_id: resource.chapter_id,
        status: "pending"
      });

    if (error) throw error;

    staffToast(
      "Resource submitted for review."
    );

    await refreshStaff();

  } catch (error) {

    console.error(error);

    staffToast(
      error?.message ||
      "Could not submit resource.",
      "error"
    );
  }
}

/* -----------------------------
   Request change to published resource
----------------------------- */

async function requestResourceUpdate(resourceId) {
  const resource = staffResources.find(
    r => r.id === resourceId
  );

  if (!resource) {
    staffToast("Resource not found.", "error");
    return;
  }

  try {

    const { error } = await sb
      .from("resource_change_requests")
      .insert({
        resource_id: resource.id,
        submitted_by: staffCtx.user.id,
        action: "update",
        title: resource.title,
        resource_type: resource.resource_type,
        description: resource.description,
        content: resource.content,
        file_path: resource.file_path,
        external_url: resource.external_url,
        chapter_id: resource.chapter_id,
        status: "pending"
      });

    if (error) throw error;

    staffToast(
      "Change request submitted for review."
    );

    await refreshStaff();

  } catch (error) {

    console.error(error);

    staffToast(
      error?.message ||
      "Could not submit change request.",
      "error"
    );
  }
}

/* -----------------------------
   Refresh
----------------------------- */

async function refreshStaff() {
  try {

    await Promise.all([
      loadStaffAccess(),
      loadStaffResources(),
      loadStaffReviews()
    ]);

    renderAllStaff();

  } catch (error) {

    console.error(error);

    staffToast(
      error?.message ||
      "Could not refresh staff workspace.",
      "error"
    );
  }
}

/* -----------------------------
   Start
----------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  initStaff
);
