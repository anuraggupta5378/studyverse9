let chapters = [], resources = [], profiles = [];

function closeModal() {
  modal.classList.remove("open");
}

function showModal(html) {
  modalBody.innerHTML = html;
  modal.classList.add("open");
}

async function loadAdmin() {
  const ctx = await requireRole(["admin"]);
  if (!ctx) return;

  try {
    [chapters, resources] = await Promise.all([
      fetchAllChapters(),
      fetchResources()
    ]);

    chapters = chapters.filter(
      c => !/^number systems$/i.test((c.name || "").trim())
    );

    const { data: p, error: pe } = await sb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (pe) throw pe;
    profiles = p || [];

    const { data: a, error: ae } = await sb
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (ae) throw ae;

    overview.innerHTML = [
      ["Published chapters",
       chapters.filter(x => x.is_published).length],
      ["Total chapters", chapters.length],
      ["Resources", resources.length],
      ["Users", profiles.length]
    ].map(x => `
      <div class="card">
        <div class="tag">${esc(x[0])}</div>
        <div class="stat">${esc(x[1])}</div>
      </div>
    `).join("");

    chapterTable.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Chapter</th>
            <th>State</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${chapters.map(c => `
            <tr>
              <td>
                <b>${esc(c.chapter_number ?? c.display_order)}.</b>
                ${esc(c.name)}
              </td>

              <td>
                ${c.is_published ? "Published" : "Draft"}
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
                    ${c.is_published ? "Unpublish" : "Publish"}
                  </button>

                  <button
                    class="btn small danger"
                    onclick="deleteChapter('${c.id}')">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    resourceTable.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Type</th>
            <th>Chapter</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${resources.map(r => `
            <tr>
              <td>${esc(r.title || "Untitled")}</td>

              <td>${esc(resourceType(r))}</td>

              <td>
                ${esc(
                  (chapters.find(c => c.id === r.chapter_id) || {})
                    .name || "—"
                )}
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
          `).join("")}
        </tbody>
      </table>
    `;

    announcementTable.innerHTML =
      (a || []).map(x => `
        <article class="resource">
          <div>
            <span class="pill">
              ${x.is_published ? "Published" : "Draft"}
            </span>

            <h3>${esc(x.title || "")}</h3>

            <p class="muted">
              ${esc(x.message || x.content || "")}
            </p>
          </div>

          <button
            class="btn small"
            onclick="toggleAnnouncement(
              '${x.id}',
              ${!x.is_published}
            )">
            ${x.is_published ? "Unpublish" : "Publish"}
          </button>
        </article>
      `).join("") ||
      '<div class="empty">No announcements.</div>';

  } catch (e) {
    console.error(e);
    toast(e.message, "error");
  }
}

async function saveChapter(id) {
  const f = new FormData(
    document.getElementById("chapterForm")
  );

  const payload = {
    name: f.get("name").trim(),
    chapter_number: Number(f.get("number")),
    slug: slugify(f.get("name")),
    description: f.get("description").trim(),
    display_order: Number(f.get("order")),
    is_published: f.get("published") === "on",
    subject_id: f.get("subject_id") || null
  };

  try {
    if (id) {
      const { error } = await sb
        .from("chapters")
        .update(payload)
        .eq("id", id);

      if (error) throw error;
    } else {
      const { error } = await sb
        .from("chapters")
        .insert(payload);

      if (error) throw error;
    }

    closeModal();
    toast("Chapter saved.");
    loadAdmin();

  } catch (e) {
    toast(e.message, "error");
  }
}

async function openChapter(id) {
  const c = chapters.find(x => x.id === id) || {};

  let subjects = [];

  try {
    const { data } = await sb
      .from("subjects")
      .select("id,name")
      .order("name");

    subjects = data || [];
  } catch {}

  showModal(`
    <h2>${id ? "Edit" : "Add"} chapter</h2>

    <form id="chapterForm" class="form">

      <div>
        <label>Chapter name</label>
        <input
          name="name"
          value="${esc(c.name || "")}"
          required>
      </div>

      <div class="grid">

        <div>
          <label>Chapter number</label>
          <input
            name="number"
            type="number"
            value="${esc(c.chapter_number ?? 1)}"
            required>
        </div>

        <div>
          <label>Display order</label>
          <input
            name="order"
            type="number"
            value="${esc(c.display_order ?? 1)}"
            required>
        </div>

      </div>

      <div>
        <label>Subject</label>

        <select name="subject_id">
          ${subjects.map(s => `
            <option
              value="${s.id}"
              ${s.id === c.subject_id ? "selected" : ""}>
              ${esc(s.name)}
            </option>
          `).join("")}
        </select>
      </div>

      <div>
        <label>Description</label>
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
        <button class="btn">Save</button>

        <button
          type="button"
          class="btn alt"
          onclick="closeModal()">
          Cancel
        </button>
      </div>

    </form>
  `);

  chapterForm.onsubmit = e => {
    e.preventDefault();
    saveChapter(id);
  };
}

async function toggleChapter(id, state) {
  const { error } = await sb
    .from("chapters")
    .update({ is_published: state })
    .eq("id", id);

  if (error) {
    toast(error.message, "error");
  } else {
    toast("Chapter state updated.");
    loadAdmin();
  }
}

async function deleteChapter(id) {
  if (!confirm(
    "Delete this chapter? Its resources may block deletion if foreign keys require them to be removed first."
  )) return;

  try {
    const { error } = await sb
      .from("chapters")
      .delete()
      .eq("id", id);

    if (error) throw error;

    toast("Chapter deleted.");
    loadAdmin();

  } catch (e) {
    toast(e.message, "error");
  }
}

function pickResourceField(row, names) {
  return names.find(
    n => row &&
      Object.prototype.hasOwnProperty.call(row, n)
  ) || names[0];
}

async function saveResource(id) {
  const f = new FormData(
    document.getElementById("resourceForm")
  );

  const type = f.get("type");
  const title = f.get("title").trim();
  const chapter_id = f.get("chapter_id");
  const desc = f.get("description").trim();
  const file_path = f.get("file_path").trim();
  const external_url = f.get("external_url").trim();
  const published = f.get("published") === "on";

  const base =
    resources.find(x => x.id === id) ||
    resources[0] ||
    {};

  const payload = {};

  payload[pickResourceField(base, ["title"])] = title;

  payload[
    pickResourceField(base, ["chapter_id"])
  ] = chapter_id;

  payload[
    pickResourceField(base, ["description"])
  ] = desc;

  payload[
    pickResourceField(
      base,
      ["resource_type", "type", "kind"]
    )
  ] = type;

  if (file_path) {
    payload[
      pickResourceField(
        base,
        ["file_path", "storage_path", "path", "file"]
      )
    ] = file_path;
  }

  if (external_url) {
    payload[
      pickResourceField(
        base,
        ["external_url", "url", "video_url", "link"]
      )
    ] = external_url;
  }

  payload[
    pickResourceField(
      base,
      ["is_published", "published"]
    )
  ] = published;

  try {
    const q = id
      ? sb.from("resources").update(payload).eq("id", id)
      : sb.from("resources").insert(payload);

    const { error } = await q;

    if (error) throw error;

    closeModal();
    toast("Resource saved.");
    loadAdmin();

  } catch (e) {
    toast(e.message, "error");
  }
}

function openResourceForm(id) {
  const r = resources.find(x => x.id === id) || {};

  showModal(`
    <h2>${id ? "Edit" : "Add"} resource</h2>

    <form id="resourceForm" class="form">

      <div>
        <label>Title</label>
        <input
          name="title"
          value="${esc(r.title || "")}"
          required>
      </div>

      <div>
        <label>Chapter</label>

        <select name="chapter_id">
          ${chapters.map(c => `
            <option
              value="${c.id}"
              ${c.id === r.chapter_id ? "selected" : ""}>
              ${esc(c.name)}
            </option>
          `).join("")}
        </select>
      </div>

      <div>
        <label>Type</label>

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
                ${resourceType(r) === t ? "selected" : ""}>
                ${t}
              </option>
            `).join("")
          }
        </select>
      </div>

      <div>
        <label>Description</label>
        <textarea
          name="description">${esc(r.description || "")}</textarea>
      </div>

      <div>
        <label>Storage file path (optional)</label>
        <input
          name="file_path"
          value="${esc(resourcePath(r))}"
          placeholder="subject/chapter/file.pdf">
      </div>

      <div>
        <label>External URL / video URL (optional)</label>
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
        <button class="btn">Save</button>

        <button
          type="button"
          class="btn alt"
          onclick="closeModal()">
          Cancel
        </button>
      </div>

    </form>
  `);

  resourceForm.onsubmit = e => {
    e.preventDefault();
    saveResource(id);
  };
}

async function deleteResource(id) {
  if (!confirm("Delete this resource record?")) return;

  const { error } = await sb
    .from("resources")
    .delete()
    .eq("id", id);

  if (error) {
    toast(error.message, "error");
  } else {
    toast("Resource deleted.");
    loadAdmin();
  }
}

async function openAnnouncement(id) {
  const { data } = await sb
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const a = data || {};

  showModal(`
    <h2>${id ? "Edit" : "New"} announcement</h2>

    <form id="announcementForm" class="form">

      <div>
        <label>Title</label>
        <input
          name="title"
          value="${esc(a.title || "")}"
          required>
      </div>

      <div>
        <label>Message</label>
        <textarea
          name="message"
          required>${esc(a.message || a.content || "")}</textarea>
      </div>

      <label>
        <input
          name="published"
          type="checkbox"
          ${a.is_published ? "checked" : ""}>
        Published
      </label>

      <div class="actions">
        <button class="btn">Save</button>

        <button
          type="button"
          class="btn alt"
          onclick="closeModal()">
          Cancel
        </button>
      </div>

    </form>
  `);

  announcementForm.onsubmit = async e => {
    e.preventDefault();

    const f = new FormData(announcementForm);

    const p = {
      title: f.get("title").trim(),
      message: f.get("message").trim(),
      is_published: f.get("published") === "on"
    };

    try {
      const q = id
        ? sb.from("announcements").update(p).eq("id", id)
        : sb.from("announcements").insert(p);

      const { error } = await q;

      if (error) throw error;

      closeModal();
      toast("Announcement saved.");
      loadAdmin();

    } catch (e) {
      toast(e.message, "error");
    }
  };
}

async function toggleAnnouncement(id, state) {
  const { error } = await sb
    .from("announcements")
    .update({ is_published: state })
    .eq("id", id);

  if (error) {
    toast(error.message, "error");
  } else {
    loadAdmin();
  }
}

loadAdmin();
