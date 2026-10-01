let announcements = [];

(async function () {

  const access =
    await requireRole(["admin"]);

  if (!access) return;

  await loadAnnouncements();

})();

async function loadAnnouncements() {

  try {

    const { data, error } =
      await sb
        .from("announcements")
        .select("*")
        .order("created_at", {
          ascending: false
        });

    if (error) throw error;

    announcements = data || [];

    renderAnnouncements();

  } catch (error) {
    toast(error.message);
  }
}

function renderAnnouncements() {

  const el =
    document.getElementById(
      "announcementList"
    );

  if (!announcements.length) {
    el.innerHTML =
      `<div class="empty">
        No announcements yet.
      </div>`;
    return;
  }

  el.innerHTML =
    announcements.map(item => `
      <div class="row">

        <div>
          <div class="rowtitle">
            ${esc(item.title)}
          </div>

          <div class="rowsub">
            ${new Date(
              item.created_at
            ).toLocaleString()}
          </div>
        </div>

        <div class="actions">

          <span class="badge ${
            item.is_published
              ? "good"
              : "warn"
          }">
            ${
              item.is_published
                ? "Published"
                : "Draft"
            }
          </span>

          <button
            class="btn small"
            onclick="toggleAnnouncement(
              '${item.id}',
              ${!item.is_published}
            )"
          >
            ${
              item.is_published
                ? "Unpublish"
                : "Publish"
            }
          </button>

        </div>

      </div>
    `).join("");
}

function openAnnouncement() {

  document.getElementById("aTitle")
    .value = "";

  document.getElementById("aMessage")
    .value = "";

  document
    .getElementById("modal")
    .classList.add("show");
}

function closeModal() {
  document
    .getElementById("modal")
    .classList.remove("show");
}

async function saveAnnouncement() {

  try {

    const user =
      await currentUser();

    const { error } =
      await sb
        .from("announcements")
        .insert({
          title:
            document.getElementById("aTitle")
              .value
              .trim(),

          message:
            document.getElementById("aMessage")
              .value
              .trim(),

          is_published: false,
          created_by: user.id
        });

    if (error) throw error;

    closeModal();

    await loadAnnouncements();

  } catch (error) {
    toast(error.message);
  }
}

async function toggleAnnouncement(
  id,
  published
) {

  try {

    const { error } =
      await sb
        .from("announcements")
        .update({
          is_published: published
        })
        .eq("id", id);

    if (error) throw error;

    await loadAnnouncements();

  } catch (error) {
    toast(error.message);
  }
  }
