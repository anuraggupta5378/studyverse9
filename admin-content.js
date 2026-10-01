let chapters = [];
let resources = [];

(async function () {
  const access = await requireRole(["admin"]);
  if (!access) return;

  document
    .getElementById("resourceSearch")
    .addEventListener("input", renderResources);

  await loadContent();
})();

async function loadContent() {
  try {
    chapters = await fetchAllChapters();
    resources = await fetchResources();

    renderChapters();
    renderResources();

  } catch (error) {
    console.error(error);
    toast(error.message || "Could not load content.");
  }
}

function renderChapters() {
  const el =
    document.getElementById("chapters");

  if (!chapters.length) {
    el.innerHTML =
      `<div class="empty">No chapters.</div>`;
    return;
  }

  el.innerHTML = chapters.map(chapter => `
    <div class="row">

      <div>
        <div class="rowtitle">
          ${esc(chapter.name)}
        </div>

        <div class="rowsub">
          Order ${chapter.display_order || 0}
        </div>
      </div>

      <div class="actions">

        <span class="badge ${
          chapter.is_published
            ? "good"
            : "warn"
        }">
          ${
            chapter.is_published
              ? "Published"
              : "Draft"
          }
        </span>

        <button
          class="btn small"
          onclick="toggleChapter(
            '${chapter.id}',
            ${!chapter.is_published}
          )"
        >
          ${
            chapter.is_published
              ? "Unpublish"
              : "Publish"
          }
        </button>

      </div>

    </div>
  `).join("");
}

function renderResources() {
  const search =
    document
      .getElementById("resourceSearch")
      .value
      .toLowerCase()
      .trim();

  const list =
    resources.filter(resource =>
      !search ||
      `${resource.title || ""}
       ${resource.description || ""}`
        .toLowerCase()
        .includes(search)
    );

  const el =
    document.getElementById("resources");

  if (!list.length) {
    el.innerHTML =
      `<div class="empty">No resources found.</div>`;
    return;
  }

  el.innerHTML = list.map(resource => `
    <div class="row">

      <div>
        <div class="rowtitle">
          ${esc(resource.title)}
        </div>

        <div class="rowsub">
          ${esc(resource.resource_type)}
        </div>
      </div>

      <div class="actions">

        <span class="badge ${
          resource.is_published
            ? "good"
            : "warn"
        }">
          ${
            resource.is_published
              ? "Published"
              : "Draft"
          }
        </span>

        <button
          class="btn small"
          onclick="editResource('${resource.id}')"
        >
          Edit
        </button>

      </div>

    </div>
  `).join("");
}

async function toggleChapter(id, published) {
  try {
    const { error } =
      await sb
        .from("chapters")
        .update({
          is_published: published
        })
        .eq("id", id);

    if (error) throw error;

    await loadContent();

  } catch (error) {
    toast(error.message);
  }
}

function openChapter() {

  document.getElementById("modalTitle")
    .textContent = "Add chapter";

  document.getElementById("modalBody")
    .innerHTML = `
      <div class="field">
        <label>Chapter name</label>
        <input id="cName">
      </div>

      <div class="field">
        <label>Display order</label>
        <input
          id="cOrder"
          type="number"
          value="${chapters.length + 1}"
        >
      </div>

      <button
        class="btn primary"
        onclick="saveChapter()"
      >
        Save chapter
      </button>
    `;

  document
    .getElementById("modal")
    .classList.add("show");
}

async function saveChapter() {

  try {

    const { error } =
      await sb
        .from("chapters")
        .insert({
          name:
            document.getElementById("cName")
              .value
              .trim(),

          display_order:
            Number(
              document.getElementById("cOrder")
                .value
            ) || 1,

          is_published: false
        });

    if (error) throw error;

    closeModal();

    await loadContent();

  } catch (error) {
    toast(error.message);
  }
}

function openResource(resource = {}) {

  document.getElementById("modalTitle")
    .textContent =
      resource.id
        ? "Edit resource"
        : "Add resource";

  document.getElementById("modalBody")
    .innerHTML = `
      <div class="field">
        <label>Title</label>
        <input
          id="rTitle"
          value="${esc(resource.title || "")}"
        >
      </div>

      <div class="field">
        <label>Chapter ID</label>
        <input
          id="rChapter"
          value="${esc(resource.chapter_id || "")}"
        >
      </div>

      <div class="field">
        <label>Type</label>
        <select id="rType">

          ${[
            "notes",
            "solution",
            "exercise",
            "video",
            "pdf",
            "important"
          ].map(type => `
            <option
              ${resource.resource_type === type
                ? "selected"
                : ""}
            >
              ${type}
            </option>
          `).join("")}

        </select>
      </div>

      <div class="field">
        <label>Description</label>
        <textarea id="rDesc">${esc(
          resource.description || ""
        )}</textarea>
      </div>

      <div class="field">
        <label>External URL</label>
        <input
          id="rUrl"
          value="${esc(resource.external_url || "")}"
        >
      </div>

      <button
        class="btn primary"
        onclick="saveResource('${resource.id || ""}')"
      >
        Save resource
      </button>
    `;

  document
    .getElementById("modal")
    .classList.add("show");
}

function editResource(id) {

  const resource =
    resources.find(r => r.id === id);

  if (resource) {
    openResource(resource);
  }
}

async function saveResource(id) {

  try {

    const user = await currentUser();

    const payload = {
      title:
        document.getElementById("rTitle")
          .value
          .trim(),

      chapter_id:
        document.getElementById("rChapter")
          .value
          .trim(),

      resource_type:
        document.getElementById("rType")
          .value,

      description:
        document.getElementById("rDesc")
          .value,

      external_url:
        document.getElementById("rUrl")
          .value
          .trim(),

      updated_by: user.id
    };

    let result;

    if (id) {

      result =
        await sb
          .from("resources")
          .update(payload)
          .eq("id", id);

    } else {

      result =
        await sb
          .from("resources")
          .insert({
            ...payload,
            created_by: user.id,
            is_published: false
          });
    }

    if (result.error)
      throw result.error;

    closeModal();

    await loadContent();

  } catch (error) {
    toast(error.message);
  }
}

function closeModal() {
  document
    .getElementById("modal")
    .classList.remove("show");
          }
