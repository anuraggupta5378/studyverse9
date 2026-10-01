/* =========================================================
   STUDYVERSE 9 — ADMIN CONTROL CENTRE
   ========================================================= */

let chapters = [];
let resources = [];
let profiles = [];
let announcements = [];
let notifications = [];
let reviewRequests = [];

const $ = id => document.getElementById(id);


/* =========================================================
   MODAL
   ========================================================= */

function closeModal(){
  const m = $("modal");

  if(m){
    m.classList.remove("open");
  }
}


function showModal(html){
  const body = $("modalBody");
  const m = $("modal");

  if(!body || !m) return;

  body.innerHTML = html;
  m.classList.add("open");
}


/* =========================================================
   HELPERS
   ========================================================= */

function formatNumber(value){
  return Number(value || 0).toLocaleString("en-IN");
}


function formatDuration(seconds){
  seconds = Number(seconds || 0);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if(hours){
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}


function formatDate(value){
  if(!value) return "—";

  return new Date(value).toLocaleString(
    "en-IN",
    {
      dateStyle:"medium",
      timeStyle:"short"
    }
  );
}


function roleClass(role){
  return `role-${String(role || "student").toLowerCase()}`;
}


function statusClass(status){
  return String(status || "").toLowerCase();
}


/* =========================================================
   ANALYTICS
   ========================================================= */

async function callAdminRPC(name){

  const {data,error} = await sb.rpc(name);

  if(error){
    console.error(name,error);
    return 0;
  }

  return data ?? 0;
}


async function loadAnalytics(){

  const [
    totalVisits,
    visitsToday,
    totalRegistered,
    newRegistrations,
    staffSeconds,
    managerSeconds
  ] = await Promise.all([

    callAdminRPC("admin_total_visits"),

    callAdminRPC("admin_visits_today"),

    callAdminRPC("admin_total_registered"),

    callAdminRPC("admin_new_registrations_today"),

    callAdminRPC("admin_staff_active_seconds_today"),

    callAdminRPC("admin_manager_active_seconds_today")

  ]);


  const publishedResources =
    resources.filter(r => r.is_published).length;


  const publishedChapters =
    chapters.filter(c => c.is_published).length;


  const unreadNotifications =
    notifications.filter(n => !n.is_read).length;


  $("overview").innerHTML = [

    [
      "Registered users",
      formatNumber(totalRegistered),
      "Accounts"
    ],

    [
      "New registrations today",
      formatNumber(newRegistrations),
      "Today"
    ],

    [
      "Visits today",
      formatNumber(visitsToday),
      "Site visits"
    ],

    [
      "Total visits",
      formatNumber(totalVisits),
      "All recorded visits"
    ],

    [
      "Staff active today",
      formatDuration(staffSeconds),
      "Tracked activity"
    ],

    [
      "Manager active today",
      formatDuration(managerSeconds),
      "Tracked activity"
    ],

    [
      "Published resources",
      formatNumber(publishedResources),
      `${resources.length} total`
    ],

    [
      "Published chapters",
      formatNumber(publishedChapters),
      `${chapters.length} total`
    ],

    [
      "Notifications",
      formatNumber(unreadNotifications),
      "Unread"
    ]

  ].map(item => `

    <div class="card admin-stat">

      <div class="tag">
        ${esc(item[0])}
      </div>

      <div class="stat">
        ${esc(item[1])}
      </div>

      <div class="muted">
        ${esc(item[2])}
      </div>

    </div>

  `).join("");
}


/* =========================================================
   NOTIFICATIONS
   ========================================================= */

async function loadNotifications(){

  const {data,error} = await sb
    .from("admin_notifications")
    .select("*")
    .order("created_at",{ascending:false})
    .limit(30);


  if(error){
    console.error(error);

    $("notifications").innerHTML =
      `<div class="empty">Unable to load notifications.</div>`;

    return;
  }


  notifications = data || [];


  if(!notifications.length){

    $("notifications").innerHTML =
      `<div class="empty">No notifications yet.</div>`;

    return;
  }


  $("notifications").innerHTML =
    notifications.map(n => `

      <article class="
        notification
        ${n.is_read ? "" : "unread"}
      ">

        <div>

          <h3>
            ${esc(n.title || "Notification")}
          </h3>

          <p>
            ${esc(n.message || "")}
          </p>

          <small class="muted">
            ${formatDate(n.created_at)}
          </small>

        </div>

        ${
          n.is_read
          ? ""
          : `
            <button
              class="btn small"
              onclick="markNotificationRead('${n.id}')">
              Mark read
            </button>
          `
        }

      </article>

    `).join("");
}


async function markNotificationRead(id){

  const {error} = await sb
    .from("admin_notifications")
    .update({is_read:true})
    .eq("id",id);


  if(error){

    toast(error.message,"error");
    return;

  }


  toast("Notification marked as read.");

  await loadNotifications();
  await loadAnalytics();
}


async function markAllNotificationsRead(){

  const unread =
    notifications.filter(n => !n.is_read);


  if(!unread.length){

    toast("No unread notifications.");
    return;

  }


  const {error} = await sb
    .from("admin_notifications")
    .update({is_read:true})
    .eq("is_read",false);


  if(error){

    toast(error.message,"error");
    return;

  }


  toast("All notifications marked as read.");

  await loadNotifications();
  await loadAnalytics();
}


/* =========================================================
   REVIEW QUEUE
   ========================================================= */

async function loadReviewQueue(){

  const {data,error} = await sb
    .from("resource_change_requests")
    .select("*")
    .order("created_at",{ascending:false})
    .limit(50);


  if(error){

    console.error(error);

    $("reviewQueue").innerHTML =
      `<div class="empty">Unable to load review queue.</div>`;

    return;
  }


  reviewRequests = data || [];


  const pending =
    reviewRequests.filter(r => r.status === "pending");


  if(!pending.length){

    $("reviewQueue").innerHTML =
      `<div class="empty">
        No pending resource changes.
      </div>`;

    return;

  }


  $("reviewQueue").innerHTML = `

    <div class="wide-table">

      <table class="table">

        <thead>

          <tr>
            <th>Resource</th>
            <th>Action</th>
            <th>Type</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>

        </thead>

        <tbody>

          ${
            pending.map(r => `

              <tr>

                <td>
                  <b>${esc(r.title || "Untitled")}</b>
                  <br>
                  <small class="muted">
                    ${esc(r.description || "")}
                  </small>
                </td>

                <td>
                  <span class="status pending">
                    ${esc(r.action || "update")}
                  </span>
                </td>

                <td>
                  ${esc(r.resource_type || "—")}
                </td>

                <td>
                  ${formatDate(r.created_at)}
                </td>

                <td>

                  <div class="actions">

                    <button
                      class="btn small"
                      onclick="approveRequest('${r.id}')">
                      Approve
                    </button>

                    <button
                      class="btn small danger"
                      onclick="rejectRequest('${r.id}')">
                      Reject
                    </button>

                  </div>

                </td>

              </tr>

            `).join("")
          }

        </tbody>

      </table>

    </div>
  `;
}


/* =========================================================
   APPROVE RESOURCE REQUEST
   ========================================================= */

async function approveRequest(id){

  const request =
    reviewRequests.find(r => r.id === id);


  if(!request){

    toast("Request not found.","error");
    return;

  }


  if(!confirm(
    `Approve this ${request.action || "resource"} request?`
  )) return;


  try{

    if(request.action === "delete"){

      if(request.resource_id){

        const {error} = await sb
          .from("resources")
          .delete()
          .eq("id",request.resource_id);

        if(error) throw error;
      }

    }else{

      const payload = {

        title:request.title,

        resource_type:
          request.resource_type || "notes",

        description:
          request.description || null,

        content:
          request.content || null,

        file_path:
          request.file_path || null,

        external_url:
          request.external_url || null,

        chapter_id:
          request.chapter_id || null,

        is_published:true,

        updated_by:
          request.submitted_by

      };


      if(request.action === "create"){

        const {error} = await sb
          .from("resources")
          .update(payload)
          .eq("id",request.resource_id);

        if(error) throw error;

      }else{

        const {error} = await sb
          .from("resources")
          .update(payload)
          .eq("id",request.resource_id);

        if(error) throw error;

      }

    }


    const {error:reviewError} = await sb
      .from("resource_change_requests")
      .update({

        status:"approved",

        reviewed_by:(await currentUser()).id,

        reviewed_at:new Date().toISOString(),

        review_note:"Approved by administrator."

      })
      .eq("id",id);


    if(reviewError) throw reviewError;


    await createAdminNotification(
      request.submitted_by,
      "resource_approved",
      "Resource request approved",
      `The ${request.action || "resource"} request "${request.title || "Untitled"}" was approved.`
    );


    toast("Resource request approved.");

    await refreshAll();

  }catch(e){

    console.error(e);
    toast(e.message,"error");

  }
}


/* =========================================================
   REJECT RESOURCE REQUEST
   ========================================================= */

async function rejectRequest(id){

  const request =
    reviewRequests.find(r => r.id === id);


  if(!request) return;


  const note =
    prompt(
      "Reason for rejection (optional):",
      ""
    );


  if(note === null) return;


  try{

    const user =
      await currentUser();


    const {error} = await sb
      .from("resource_change_requests")
      .update({

        status:"rejected",

        reviewed_by:user.id,

        reviewed_at:new Date().toISOString(),

        review_note:
          note || "Rejected by administrator."

      })
      .eq("id",id);


    if(error) throw error;


    await createAdminNotification(
      request.submitted_by,
      "resource_rejected",
      "Resource request rejected",
      `The ${request.action || "resource"} request "${request.title || "Untitled"}" was rejected.`
    );


    toast("Resource request rejected.");

    await refreshAll();

  }catch(e){

    toast(e.message,"error");

  }
}


/* =========================================================
   NOTIFICATION CREATION
   ========================================================= */

async function createAdminNotification(
  actorId,
  type,
  title,
  message,
  resourceId = null
){

  /*
    This is best-effort.
    The trigger-created staff notifications remain
    independent of this helper.
  */

  const payload = {

    actor_id:actorId,

    type,

    title,

    message,

    resource_id:resourceId

  };


  const {error} = await sb
    .from("admin_notifications")
    .insert(payload);


  if(error){

    console.warn(
      "Notification insert failed:",
      error.message
    );

  }
}


/* =========================================================
   USERS / ROLES
   ========================================================= */

async function loadUsers(){

  const {data,error} = await sb
    .from("profiles")
    .select("*")
    .order("created_at",{ascending:false});


  if(error){

    console.error(error);

    $("userTable").innerHTML =
      `<div class="empty">Unable to load users.</div>`;

    return;

  }


  profiles = data || [];


  $("userTable").innerHTML = `

    <table class="table">

      <thead>

        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Joined</th>
          <th>Role action</th>
        </tr>

      </thead>

      <tbody>

        ${
          profiles.map(p => `

            <tr>

              <td>

                <b>
                  ${esc(p.full_name || "Unnamed")}
                </b>

                <br>

                <small class="muted">
                  ${esc(p.id)}
                </small>

              </td>

              <td>

                <span class="
                  role-pill
                  ${roleClass(p.role)}
                ">
                  ${esc(p.role || "student")}
                </span>

              </td>

              <td>
                ${formatDate(p.created_at)}
              </td>

              <td>

                ${
                  p.role === "admin"

                  ? `
                    <span class="muted">
                      Protected
                    </span>
                  `

                  : `
                    <button
                      class="btn small"
                      onclick="openRoleModal(
                        '${p.id}',
                        '${esc(p.full_name || "User")}',
                        '${esc(p.role || "student")}'
                      )">
                      Change role
                    </button>
                  `
                }

              </td>

            </tr>

          `).join("")
        }

      </tbody>

    </table>
  `;
}


function openRoleModal(id,name,currentRole){

  showModal(`

    <h2>Change user role</h2>

    <p class="muted">
      ${esc(name)}
    </p>

    <form id="roleForm" class="form">

      <input
        type="hidden"
        name="id"
        value="${esc(id)}">

      <div>

        <label>
          Role
        </label>

        <select name="role">

          ${
            ["student","staff","manager","admin"]
              .map(role => `

                <option
                  value="${role}"
                  ${role === currentRole ? "selected" : ""}>
                  ${role}
                </option>

              `).join("")
          }

        </select>

      </div>

      <div class="actions">

        <button class="btn">
          Save role
        </button>

        <button
          type="button"
          class="btn alt"
          onclick="closeModal()">
          Cancel
        </button>

      </div>

    </form>

  `);


  $("roleForm").onsubmit =
    async e => {

      e.preventDefault();


      const f =
        new FormData(e.currentTarget);


      const target =
        f.get("id");


      const newRole =
        f.get("role");


      try{

        const {error} =
          await sb.rpc(
            "set_user_role",
            {
              target_user_id:target,
              new_role:newRole
            }
          );


        if(error) throw error;


        closeModal();

        toast("User role updated.");

        await loadUsers();

        await loadAnalytics();

      }catch(err){

        toast(err.message,"error");

      }

    };
}


/* =========================================================
   CHAPTERS
   ========================================================= */

async function loadChapters(){

  chapters =
    await fetchAllChapters();


  chapters =
    chapters.filter(
      c =>
        !/^number systems$/i.test(
          (c.name || "").trim()
        )
    );


  $("chapterTable").innerHTML = `

    <table class="table">

      <thead>

        <tr>
          <th>Chapter</th>
          <th>State</th>
          <th>Actions</th>
        </tr>

      </thead>

      <tbody>

        ${
          chapters.map(c => `

            <tr>

              <td>

                <b>
                  ${esc(
                    c.chapter_number ??
                    c.display_order ??
                    ""
                  )}.
                </b>

                ${esc(c.name)}

              </td>

              <td>

                <span class="
                  status
                  ${c.is_published ? "published" : ""}
                ">
                  ${c.is_published
                    ? "Published"
                    : "Draft"}
                </span>

              </td>

              <td>

                <div class="actions">

                  <button
                    class="btn small"
                    onclick="openChapter('${c.id}')">
                    Edit
                  </button>

                  <button
                    class="btn small alt"
                    onclick="toggleChapter(
                      '${c.id}',
                      ${!c.is_published}
                    )">

                    ${
                      c.is_published
                      ? "Unpublish"
                      : "Publish"
                    }

                  </button>

                  <button
                    class="btn small danger"
                    onclick="deleteChapter('${c.id}')">
                    Delete
                  </button>

                </div>

              </td>

            </tr>

          `).join("")
        }

      </tbody>

    </table>
  `;
}


async function openChapter(id){

  const c =
    chapters.find(x => x.id === id) || {};


  let subjects = [];


  try{

    const {data} = await sb
      .from("subjects")
      .select("id,name")
      .order("name");

    subjects = data || [];

  }catch{}


  showModal(`

    <h2>
      ${id ? "Edit" : "Add"} chapter
    </h2>

    <form id="chapterForm" class="form">

      <div>

        <label>
          Chapter name
        </label>

        <input
          name="name"
          value="${esc(c.name || "")}"
          required>

      </div>


      <div class="grid">

        <div>

          <label>
            Chapter number
          </label>

          <input
            name="number"
            type="number"
            value="${esc(c.chapter_number ?? 1)}"
            required>

        </div>


        <div>

          <label>
            Display order
          </label>

          <input
            name="order"
            type="number"
            value="${esc(c.display_order ?? 1)}"
            required>

        </div>

      </div>


      <div>

        <label>
          Subject
        </label>

        <select name="subject_id">

          ${
            subjects.map(s => `

              <option
                value="${s.id}"
                ${s.id === c.subject_id ? "selected" : ""}>
                ${esc(s.name)}
              </option>

            `).join("")
          }

        </select>

      </div>


      <div>

        <label>
          Description
        </label>

        <textarea
          name="description">${esc(c.description || "")}</textarea>

      </div>


      <label>

        <input
          name="published"
          type="checkbox"
          ${c.is_published ? "checked" : ""}>

        Published

      </label>


      <div class="actions">

        <button class="btn">
          Save
        </button>

        <button
          type="button"
          class="btn alt"
          onclick="closeModal()">
          Cancel
        </button>

      </div>

    </form>

  `);


  $("chapterForm").onsubmit =
    e => {

      e.preventDefault();

      saveChapter(id);

    };
}


async function saveChapter(id){

  const f =
    new FormData($("chapterForm"));


  const payload = {

    name:f.get("name").trim(),

    chapter_number:
      Number(f.get("number")),

    slug:
      slugify(f.get("name")),

    description:
      f.get("description").trim(),

    display_order:
      Number(f.get("order")),

    is_published:
      f.get("published") === "on",

    subject_id:
      f.get("subject_id") || null

  };


  try{

    const query = id

      ? sb
          .from("chapters")
          .update(payload)
          .eq("id",id)

      : sb
          .from("chapters")
          .insert(payload);


    const {error} =
      await query;


    if(error) throw error;


    closeModal();

    toast("Chapter saved.");

    await loadChapters();

    await loadAnalytics();

  }catch(e){

    toast(e.message,"error");

  }
}


async function toggleChapter(id,state){

  const {error} = await sb
    .from("chapters")
    .update({
      is_published:state
    })
    .eq("id",id);


  if(error){

    toast(error.message,"error");

  }else{

    toast("Chapter state updated.");

    await loadChapters();

    await loadAnalytics();

  }
}


async function deleteChapter(id){

  if(!confirm(
    "Delete this chapter? Related resources may prevent deletion."
  )) return;


  const {error} = await sb
    .from("chapters")
    .delete()
    .eq("id",id);


  if(error){

    toast(error.message,"error");

  }else{

    toast("Chapter deleted.");

    await loadChapters();

    await loadAnalytics();

  }
}


/* =========================================================
   RESOURCES
   ========================================================= */

function pickResourceField(row,names){

  return names.find(
    n =>
      row &&
      Object.prototype.hasOwnProperty.call(row,n)
  ) || names[0];

}


async function loadResources(){

  resources =
    await fetchResources();


  $("resourceTable").innerHTML = `

    <table class="table">

      <thead>

        <tr>
          <th>Resource</th>
          <th>Type</th>
          <th>Chapter</th>
          <th>State</th>
          <th>Actions</th>
        </tr>

      </thead>

      <tbody>

        ${
          resources.map(r => `

            <tr>

              <td>
                <b>
                  ${esc(r.title || "Untitled")}
                </b>
              </td>

              <td>
                ${esc(resourceType(r))}
              </td>

              <td>

                ${esc(
                  (
                    chapters.find(
                      c => c.id === r.chapter_id
                    ) || {}
                  ).name || "—"
                )}

              </td>

              <td>

                <span class="
                  status
                  ${r.is_published ? "published" : ""}
                ">
                  ${r.is_published
                    ? "Published"
                    : "Draft"}
                </span>

              </td>

              <td>

                <div class="actions">

                  <button
                    class="btn small"
                    onclick="openResourceForm('${r.id}')">
                    Edit
                  </button>

                  <button
                    class="btn small danger"
                    onclick="deleteResource('${r.id}')">
                    Delete
                  </button>

                </div>

              </td>

            </tr>

          `).join("")
        }

      </tbody>

    </table>
  `;
}


function openResourceForm(id){

  const r =
    resources.find(x => x.id === id) || {};


  showModal(`

    <h2>
      ${id ? "Edit" : "Add"} resource
    </h2>

    <form id="resourceForm" class="form">

      <div>

        <label>
          Title
        </label>

        <input
          name="title"
          value="${esc(r.title || "")}"
          required>

      </div>


      <div>

        <label>
          Chapter
        </label>

        <select name="chapter_id">

          ${
            chapters.map(c => `

              <option
                value="${c.id}"
                ${c.id === r.chapter_id ? "selected" : ""}>

                ${esc(c.name)}

              </option>

            `).join("")
          }

        </select>

      </div>


      <div>

        <label>
          Type
        </label>

        <select name="type">

          ${
            [
              "notes",
              "important_questions",
              "solution",
              "exercise",
              "video",
              "pdf",
              "article",
              "learn"
            ].map(t => `

              <option
                value="${t}"
                ${resourceType(r) === t ? "selected" : ""}>

                ${t}

              </option>

            `).join("")
          }

        </select>

      </div>


      <div>

        <label>
          Description
        </label>

        <textarea
          name="description">${esc(r.description || "")}</textarea>

      </div>


      <div>

        <label>
          Storage file path
        </label>

        <input
          name="file_path"
          value="${esc(resourcePath(r))}"
          placeholder="subject/chapter/file.pdf">

      </div>


      <div>

        <label>
          External URL / video URL
        </label>

        <input
          name="external_url"
          value="${esc(resourceUrl(r))}">

      </div>


      <label>

        <input
          name="published"
          type="checkbox"
          ${r.is_published ? "checked" : ""}>

        Published

      </label>


      <div class="actions">

        <button class="btn">
          Save
        </button>

        <button
          type="button"
          class="btn alt"
          onclick="closeModal()">
          Cancel
        </button>

      </div>

    </form>

  `);


  $("resourceForm").onsubmit =
    e => {

      e.preventDefault();

      saveResource(id);

    };
}


async function saveResource(id){

  const f =
    new FormData($("resourceForm"));


  const type =
    f.get("type");


  const title =
    f.get("title").trim();


  const chapter_id =
    f.get("chapter_id");


  const description =
    f.get("description").trim();


  const file_path =
    f.get("file_path").trim();


  const external_url =
    f.get("external_url").trim();


  const published =
    f.get("published") === "on";


  const base =
    resources.find(x => x.id === id) ||
    resources[0] ||
    {};


  const payload = {};


  payload[
    pickResourceField(
      base,
      ["title"]
    )
  ] = title;


  payload[
    pickResourceField(
      base,
      ["chapter_id"]
    )
  ] = chapter_id;


  payload[
    pickResourceField(
      base,
      ["description"]
    )
  ] = description;


  payload[
    pickResourceField(
      base,
      [
        "resource_type",
        "type",
        "kind"
      ]
    )
  ] = type;


  payload[
    pickResourceField(
      base,
      [
        "file_path",
        "storage_path",
        "path",
        "file"
      ]
    )
  ] = file_path || null;


  payload[
    pickResourceField(
      base,
      [
        "external_url",
        "url",
        "video_url",
        "link"
      ]
    )
  ] = external_url || null;


  payload[
    pickResourceField(
      base,
      [
        "is_published",
        "published"
      ]
    )
  ] = published;


  try{

    const query = id

      ? sb
          .from("resources")
          .update(payload)
          .eq("id",id)

      : sb
          .from("resources")
          .insert(payload);


    const {error} =
      await query;


    if(error) throw error;


    closeModal();

    toast("Resource saved.");

    await loadResources();

    await loadAnalytics();

  }catch(e){

    toast(e.message,"error");

  }
}


async function deleteResource(id){

  if(!confirm(
    "Delete this resource record?"
  )) return;


  const {error} = await sb
    .from("resources")
    .delete()
    .eq("id",id);


  if(error){

    toast(error.message,"error");

  }else{

    toast("Resource deleted.");

    await loadResources();

    await loadAnalytics();

  }
}


/* =========================================================
   ANNOUNCEMENTS
   ========================================================= */

async function loadAnnouncements(){

  const {data,error} = await sb
    .from("announcements")
    .select("*")
    .order("created_at",{ascending:false});


  if(error){

    console.error(error);

    $("announcementTable").innerHTML =
      `<div class="empty">Unable to load announcements.</div>`;

    return;

  }


  announcements =
    data || [];


  if(!announcements.length){

    $("announcementTable").innerHTML =
      `<div class="empty">No announcements.</div>`;

    return;

  }


  $("announcementTable").innerHTML =

    announcements.map(a => `

      <article class="resource">

        <div>

          <span class="status ${
            a.is_published
              ? "published"
              : ""
          }">

            ${
              a.is_published
              ? "Published"
              : "Draft"
            }

          </span>

          <h3>
            ${esc(a.title || "")}
          </h3>

          <p class="muted">
            ${esc(
              a.message ||
              a.content ||
              ""
            )}
          </p>

        </div>


        <div class="actions">

          <button
            class="btn small"
            onclick="openAnnouncement('${a.id}')">
            Edit
          </button>

          <button
            class="btn small alt"
            onclick="toggleAnnouncement(
              '${a.id}',
              ${!a.is_published}
            )">

            ${
              a.is_published
              ? "Unpublish"
              : "Publish"
            }

          </button>

        </div>

      </article>

    `).join("");
}


async function openAnnouncement(id){

  const {data} = await sb
    .from("announcements")
    .select("*")
    .eq("id",id)
    .maybeSingle();


  const a =
    data || {};


  showModal(`

    <h2>
      ${id ? "Edit" : "New"} announcement
    </h2>

    <form id="announcementForm" class="form">

      <div>

        <label>
          Title
        </label>

        <input
          name="title"
          value="${esc(a.title || "")}"
          required>

      </div>


      <div>

        <label>
          Message
        </label>

        <textarea
          name="message"
          required>${esc(
            a.message ||
            a.content ||
            ""
          )}</textarea>

      </div>


      <label>

        <input
          name="published"
          type="checkbox"
          ${a.is_published ? "checked" : ""}>

        Published

      </label>


      <div class="actions">

        <button class="btn">
          Save
        </button>

        <button
          type="button"
          class="btn alt"
          onclick="closeModal()">
          Cancel
        </button>

      </div>

    </form>

  `);


  $("announcementForm").onsubmit =
    async e => {

      e.preventDefault();


      const f =
        new FormData(e.currentTarget);


      const payload = {

        title:
          f.get("title").trim(),

        message:
          f.get("message").trim(),

        is_published:
          f.get("published") === "on"

      };


      try{

        const query = id

          ? sb
              .from("announcements")
              .update(payload)
              .eq("id",id)

          : sb
              .from("announcements")
              .insert(payload);


        const {error} =
          await query;


        if(error) throw error;


        closeModal();

        toast("Announcement saved.");

        await loadAnnouncements();

      }catch(err){

        toast(err.message,"error");

      }

    };
}


async function toggleAnnouncement(id,state){

  const {error} = await sb
    .from("announcements")
    .update({
      is_published:state
    })
    .eq("id",id);


  if(error){

    toast(error.message,"error");

  }else{

    toast(
      state
      ? "Announcement published."
      : "Announcement unpublished."
    );

    await loadAnnouncements();

  }
}


/* =========================================================
   REFRESH EVERYTHING
   ========================================================= */

async function refreshAll(){

  try{

    await Promise.all([

      loadChapters(),

      loadResources(),

      loadUsers(),

      loadNotifications(),

      loadReviewQueue(),

      loadAnnouncements()

    ]);


    await loadAnalytics();

  }catch(e){

    console.error(e);

    toast(
      e.message || "Refresh failed.",
      "error"
    );

  }
}


/* =========================================================
   ADMIN STARTUP
   ========================================================= */

async function loadAdmin(){

  const ctx =
    await requireRole(["admin"]);


  if(!ctx) return;


  try{

    await refreshAll();

  }catch(e){

    console.error(e);

    toast(
      e.message || "Unable to load admin panel.",
      "error"
    );

  }
}


/* =========================================================
   START
   ========================================================= */

loadAdmin();
