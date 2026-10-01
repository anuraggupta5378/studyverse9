/* StudyVerse 9 — Manager Workspace */

let managerCtx = null;
let managerResources = [];
let managerReviews = [];
let managerNotifications = [];

/* -----------------------------
   Helpers
----------------------------- */

function managerEsc(value = "") {
  return String(value).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function managerToast(message, type = "ok") {
  if (typeof toast === "function") {
    toast(message, type);
  }
}

function managerDate(value) {
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

function openStudentView() {
  location.href = "dashboard.html";
}

/* -----------------------------
   Initialisation
----------------------------- */

async function initManager() {
  try {
    managerCtx = await requireRole(["manager", "admin"]);

    if (!managerCtx) return;

    const name = document.getElementById("managerName");

    if (name) {
      name.textContent =
        managerCtx.profile?.full_name || "Manager";
    }

    if (managerCtx.profile?.role === "admin") {
      const adminLink = document.getElementById("adminLink");

      if (adminLink) {
        adminLink.style.display = "";
      }
    }

    await refreshManager();

  } catch (error) {
    console.error("Manager workspace error:", error);

    managerToast(
      error?.message ||
      "Unable to load manager workspace.",
      "error"
    );
  }
}

/* -----------------------------
   Load data
----------------------------- */

async function loadManagerResources() {

  const { data, error } = await sb
    .from("resources")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) throw error;

  managerResources = data || [];
}


async function loadManagerReviews() {

  const { data, error } = await sb
    .from("resource_change_requests")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) throw error;

  managerReviews = data || [];
}


async function loadManagerNotifications() {

  const { data, error } = await sb
    .from("admin_notifications")
    .select("*")
    .order("created_at", {
      ascending: false
    })
    .limit(50);

  if (error) throw error;

  managerNotifications = data || [];
}


/* -----------------------------
   Refresh everything
----------------------------- */

async function refreshManager() {

  try {

    await Promise.all([
      loadManagerResources(),
      loadManagerReviews(),
      loadManagerNotifications()
    ]);

    renderManagerStats();
    renderReviewQueue();
    renderManagerResources();
    renderManagerNotifications();

  } catch (error) {

    console.error(error);

    managerToast(
      error?.message ||
      "Could not refresh manager workspace.",
      "error"
    );
  }
}


/* -----------------------------
   Statistics
----------------------------- */

function renderManagerStats() {

  const total =
    managerResources.length;

  const pending =
    managerReviews.filter(
      r => r.status === "pending"
    ).length;

  const published =
    managerResources.filter(
      r => r.is_published
    ).length;

  const unread =
    managerNotifications.filter(
      n => !n.is_read
    ).length;

  document.getElementById(
    "totalResources"
  ).textContent = total;

  document.getElementById(
    "pendingReviews"
  ).textContent = pending;

  document.getElementById(
    "publishedResources"
  ).textContent = published;

  document.getElementById(
    "notificationCount"
  ).textContent = unread;
}


/* -----------------------------
   Review queue
----------------------------- */

function renderReviewQueue() {

  const box =
    document.getElementById("reviewQueue");

  if (!box) return;

  const pending =
    managerReviews.filter(
      r => r.status === "pending"
    );

  if (!pending.length) {

    box.innerHTML = `
      <div class="empty-state">
        <strong>No pending reviews.</strong>
        <br>
        Staff submissions waiting for approval will appear here.
      </div>
    `;

    return;
  }

  box.innerHTML = `
    <table>

      <thead>
        <tr>
          <th>Resource</th>
          <th>Action</th>
          <th>Type</th>
          <th>Submitted</th>
          <th>Decision</th>
        </tr>
      </thead>

      <tbody>

        ${pending.map(review => `

          <tr>

            <td>
              <strong>
                ${managerEsc(
                  review.title || "Untitled resource"
                )}
              </strong>
            </td>

            <td>
              ${managerEsc(
                review.action || "update"
              )}
            </td>

            <td>
              ${managerEsc(
                review.resource_type || "resource"
              )}
            </td>

            <td>
              ${managerEsc(
                managerDate(review.created_at)
              )}
            </td>

            <td>

              <button
                class="btn small"
                onclick="approveReview('${review.id}')"
              >
                ✓ Approve & Publish
              </button>

              <button
                class="btn small"
                onclick="rejectReview('${review.id}')"
              >
                Reject
              </button>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}


/* -----------------------------
   Approve review
----------------------------- */

async function approveReview(reviewId) {

  const review =
    managerReviews.find(
      r => r.id === reviewId
    );

  if (!review) {

    managerToast(
      "Review request not found.",
      "error"
    );

    return;
  }

  if (review.status !== "pending") {

    managerToast(
      "This request has already been reviewed.",
      "error"
    );

    return;
  }

  const confirmed =
    window.confirm(
      "Approve this resource and publish it for students?"
    );

  if (!confirmed) return;

  try {

    /*
      CREATE / UPDATE:
      Apply submitted resource data.
    */

    if (
      review.action === "create" ||
      review.action === "update"
    ) {

      if (!review.resource_id) {
        throw new Error(
          "This review has no resource attached."
        );
      }

      const resourcePayload = {
        title: review.title,
        resource_type: review.resource_type,
        description: review.description,
        content: review.content,
        file_path: review.file_path,
        external_url: review.external_url,
        chapter_id: review.chapter_id,
        is_published: true,
        updated_by: managerCtx.user.id
      };

      const {
        error: resourceError
      } = await sb
        .from("resources")
        .update(resourcePayload)
        .eq("id", review.resource_id);

      if (resourceError) {
        throw resourceError;
      }
    }


    /*
      DELETE:
      Delete the resource only after approval.
    */

    if (
      review.action === "delete"
    ) {

      if (!review.resource_id) {
        throw new Error(
          "This delete request has no resource attached."
        );
      }

      const {
        error: deleteError
      } = await sb
        .from("resources")
        .delete()
        .eq("id", review.resource_id);

      if (deleteError) {
        throw deleteError;
      }
    }


    /*
      Mark request approved.
    */

    const {
      error: reviewError
    } = await sb
      .from("resource_change_requests")
      .update({
        status: "approved",
        reviewed_by: managerCtx.user.id,
        reviewed_at: new Date().toISOString(),
        review_note:
          "Approved by Manager."
      })
      .eq("id", review.id);

    if (reviewError) {
      throw reviewError;
    }


    /*
      Notification.
    */

    await sb
      .from("admin_notifications")
      .insert({
        actor_id: managerCtx.user.id,
        type: "resource_published",
        title: "Resource published",
        message:
          `"${review.title || "Resource"}" was approved and published.`,
        resource_id:
          review.resource_id || null
      });


    managerToast(
      "Resource approved and published."
    );

    await refreshManager();

  } catch (error) {

    console.error(error);

    managerToast(
      error?.message ||
      "Could not approve resource.",
      "error"
    );
  }
}


/* -----------------------------
   Reject review
----------------------------- */

async function rejectReview(reviewId) {

  const review =
    managerReviews.find(
      r => r.id === reviewId
    );

  if (!review) {

    managerToast(
      "Review request not found.",
      "error"
    );

    return;
  }

  const reason =
    window.prompt(
      "Enter a reason for rejecting this submission:"
    );

  if (reason === null) return;

  const note =
    reason.trim() ||
    "Rejected by Manager.";


  try {

    const {
      error
    } = await sb
      .from("resource_change_requests")
      .update({
        status: "rejected",
        reviewed_by: managerCtx.user.id,
        reviewed_at:
          new Date().toISOString(),
        review_note: note
      })
      .eq("id", review.id);

    if (error) throw error;


    await sb
      .from("admin_notifications")
      .insert({
        actor_id: managerCtx.user.id,
        type: "resource_rejected",
        title: "Resource submission rejected",
        message:
          `"${review.title || "Resource"}" was rejected by the Manager.`,
        resource_id:
          review.resource_id || null
      });


    managerToast(
      "Submission rejected."
    );

    await refreshManager();

  } catch (error) {

    console.error(error);

    managerToast(
      error?.message ||
      "Could not reject submission.",
      "error"
    );
  }
}


/* -----------------------------
   Resource library
----------------------------- */

function renderManagerResources() {

  const box =
    document.getElementById(
      "managerResources"
    );

  if (!box) return;

  if (!managerResources.length) {

    box.innerHTML = `
      <div class="empty-state">
        No resources have been created yet.
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
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>

        ${managerResources.map(resource => {

          const status =
            resource.is_published
              ? "published"
              : "pending";

          return `

            <tr>

              <td>
                <strong>
                  ${managerEsc(
                    resource.title ||
                    "Untitled resource"
                  )}
                </strong>
              </td>

              <td>
                ${managerEsc(
                  resource.resource_type ||
                  "resource"
                )}
              </td>

              <td>

                <span class="status ${status}">
                  ${
                    resource.is_published
                      ? "Published"
                      : "Draft"
                  }
                </span>

              </td>

              <td>
                ${managerEsc(
                  managerDate(
                    resource.created_at
                  )
                )}
              </td>

              <td>

                <button
                  class="btn small"
                  onclick="editManagerResource('${resource.id}')"
                >
                  Edit
                </button>

                ${
                  !resource.is_published
                    ? `
                      <button
                        class="btn small"
                        onclick="publishResource('${resource.id}')"
                      >
                        Publish
                      </button>
                    `
                    : ""
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
   Notifications
----------------------------- */

function renderManagerNotifications() {

  const box =
    document.getElementById(
      "managerNotifications"
    );

  if (!box) return;

  if (!managerNotifications.length) {

    box.innerHTML = `
      <div class="empty-state">
        No notifications yet.
      </div>
    `;

    return;
  }


  box.innerHTML =
    managerNotifications.map(
      notification => `

        <div class="notification ${
          notification.is_read
            ? ""
            : "unread"
        }">

          <div class="notification-title">
            ${managerEsc(
              notification.title ||
              "Notification"
            )}
          </div>

          <div class="notification-message">
            ${managerEsc(
              notification.message ||
              ""
            )}
          </div>

          <div class="notification-date">
            ${managerEsc(
              managerDate(
                notification.created_at
              )
            )}
          </div>

          ${
            !notification.is_read
              ? `
                <button
                  class="btn small"
                  style="margin-top:10px"
                  onclick="markNotificationRead('${notification.id}')"
                >
                  Mark read
                </button>
              `
              : ""
          }

        </div>

      `
    ).join("");
}


/* -----------------------------
   Mark notification read
----------------------------- */

async function markNotificationRead(id) {

  try {

    const {
      error
    } = await sb
      .from("admin_notifications")
      .update({
        is_read: true
      })
      .eq("id", id);

    if (error) throw error;

    await refreshManager();

  } catch (error) {

    console.error(error);

    managerToast(
      error?.message ||
      "Could not mark notification as read.",
      "error"
    );
  }
}


async function markAllNotificationsRead() {

  try {

    const {
      error
    } = await sb
      .from("admin_notifications")
      .update({
        is_read: true
      })
      .eq("is_read", false);

    if (error) throw error;

    managerToast(
      "Notifications marked as read."
    );

    await refreshManager();

  } catch (error) {

    console.error(error);

    managerToast(
      error?.message ||
      "Could not update notifications.",
      "error"
    );
  }
}


/* -----------------------------
   Resource editor
----------------------------- */

function openManagerResourceCreator() {
  showManagerResourceModal();
}


function editManagerResource(resourceId) {

  const resource =
    managerResources.find(
      r => r.id === resourceId
    );

  if (!resource) {

    managerToast(
      "Resource not found.",
      "error"
    );

    return;
  }

  showManagerResourceModal(resource);
}


function showManagerResourceModal(
  resource = null
) {

  const modal =
    document.getElementById(
      "managerModal"
    );

  const body =
    document.getElementById(
      "managerModalBody"
    );

  if (!modal || !body) return;

  const editing = !!resource;


  body.innerHTML = `

    <div
      class="actions"
      style="justify-content:space-between"
    >

      <h2>
        ${
          editing
            ? "Edit Resource"
            : "Add Resource"
        }
      </h2>

      <button
        class="btn small"
        onclick="closeManagerModal()"
      >
        Close
      </button>

    </div>


    <form
      id="managerResourceForm"
      style="margin-top:18px"
    >

      <label>
        Title

        <input
          id="managerTitle"
          required
          value="${managerEsc(
            resource?.title || ""
          )}"
          placeholder="Resource title"
        >
      </label>


      <label>
        Resource type

        <select id="managerType">

          ${
            [
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
                ${
                  resource?.resource_type === type
                    ? "selected"
                    : ""
                }
              >
                ${type}
              </option>

            `).join("")
          }

        </select>

      </label>


      <label>
        Chapter ID

        <input
          id="managerChapter"
          required
          value="${managerEsc(
            resource?.chapter_id || ""
          )}"
          placeholder="Chapter UUID"
        >
      </label>


      <label>
        Description

        <textarea
          id="managerDescription"
          rows="4"
          placeholder="Short description"
        >${managerEsc(
          resource?.description || ""
        )}</textarea>

      </label>


      <label>
        Content

        <textarea
          id="managerContent"
          rows="8"
          placeholder="Learning content"
        >${managerEsc(
          resource?.content || ""
        )}</textarea>

      </label>


      <label>
        External URL

        <input
          id="managerUrl"
          type="url"
          value="${managerEsc(
            resource?.external_url || ""
          )}"
          placeholder="https://..."
        >

      </label>


      <div
        class="actions"
        style="margin-top:18px"
      >

        <button
          type="submit"
          class="btn"
        >
          ${
            editing
              ? "Save Changes"
              : "Create Resource"
          }
        </button>

        <button
          type="button"
          class="btn secondary"
          onclick="closeManagerModal()"
        >
          Cancel
        </button>

      </div>

    </form>
  `;


  modal.style.display = "flex";


  document
    .getElementById(
      "managerResourceForm"
    )
    .addEventListener(
      "submit",
      event =>
        saveManagerResource(
          event,
          resource
        )
    );
}


function closeManagerModal() {

  const modal =
    document.getElementById(
      "managerModal"
    );

  if (modal) {
    modal.style.display = "none";
  }
}


/* -----------------------------
   Save manager resource
----------------------------- */

async function saveManagerResource(
  event,
  existingResource = null
) {

  event.preventDefault();

  const title =
    document
      .getElementById("managerTitle")
      .value
      .trim();

  const resourceType =
    document
      .getElementById("managerType")
      .value;

  const chapterId =
    document
      .getElementById("managerChapter")
      .value
      .trim();

  const description =
    document
      .getElementById("managerDescription")
      .value
      .trim();

  const content =
    document
      .getElementById("managerContent")
      .value
      .trim();

  const externalUrl =
    document
      .getElementById("managerUrl")
      .value
      .trim();


  if (!title || !chapterId) {

    managerToast(
      "Title and Chapter ID are required.",
      "error"
    );

    return;
  }


  try {

    if (existingResource) {

      const {
        error
      } = await sb
        .from("resources")
        .update({
          title,
          resource_type: resourceType,
          chapter_id: chapterId,
          description:
            description || null,
          content:
            content || null,
          external_url:
            externalUrl || null,
          updated_by:
            managerCtx.user.id
        })
        .eq(
          "id",
          existingResource.id
        );

      if (error) throw error;

      managerToast(
        "Resource updated."
      );

    } else {

      const {
        error
      } = await sb
        .from("resources")
        .insert({
          title,
          resource_type: resourceType,
          chapter_id: chapterId,
          description:
            description || null,
          content:
            content || null,
          external_url:
            externalUrl || null,
          is_published: false,
          created_by:
            managerCtx.user.id,
          updated_by:
            managerCtx.user.id
        });

      if (error) throw error;

      managerToast(
        "Resource created as a draft."
      );
    }


    closeManagerModal();

    await refreshManager();

  } catch (error) {

    console.error(error);

    managerToast(
      error?.message ||
      "Could not save resource.",
      "error"
    );
  }
}


/* -----------------------------
   Direct manager publishing
----------------------------- */

async function publishResource(
  resourceId
) {

  const resource =
    managerResources.find(
      r => r.id === resourceId
    );

  if (!resource) {

    managerToast(
      "Resource not found.",
      "error"
    );

    return;
  }


  if (resource.is_published) {

    managerToast(
      "Resource is already published.",
      "error"
    );

    return;
  }


  const confirmed =
    window.confirm(
      `Publish "${resource.title}" for students?`
    );

  if (!confirmed) return;


  try {

    const {
      error
    } = await sb
      .from("resources")
      .update({
        is_published: true,
        updated_by:
          managerCtx.user.id
      })
      .eq(
        "id",
        resource.id
      );

    if (error) throw error;


    await sb
      .from("admin_notifications")
      .insert({
        actor_id:
          managerCtx.user.id,
        type:
          "resource_published",
        title:
          "Resource published",
        message:
          `"${resource.title}" was published by the Manager.`,
        resource_id:
          resource.id
      });


    managerToast(
      "Resource published."
    );

    await refreshManager();

  } catch (error) {

    console.error(error);

    managerToast(
      error?.message ||
      "Could not publish resource.",
      "error"
    );
  }
}


/* -----------------------------
   Start
----------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  initManager
);
