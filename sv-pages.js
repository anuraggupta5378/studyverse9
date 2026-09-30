/* StudyVerse 9 — reusable learning pages */

const SV = {
  chapters: [],
  resources: [],
  subjects: [],
  ready: false
};

function svQ(name) {
  return new URLSearchParams(location.search).get(name) || "";
}

function svNorm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function svEsc(v = "") {
  return String(v).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

function svLabel(v) {
  return String(v || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function svChapterTitle(c) {
  return c?.name || c?.title || c?.chapter_name || "Untitled chapter";
}

function svResourceTitle(r) {
  return r?.title || r?.name || r?.resource_name || "Untitled resource";
}

function svResourceType(r) {
  return r?.resource_type || r?.type || r?.kind || "resource";
}

function svChapterId(r) {
  return r?.chapter_id || r?.chapter || r?.chapterId || "";
}

function svBook(c) {
  return c?.book_name || c?.book || c?.book_title || "Ganita Manjari";
}

function svPart(c) {
  return c?.part_name || c?.part || c?.part_title || "Part 1";
}

function svSubjectId(c) {
  return c?.subject_id || c?.subject || c?.subjectId || "";
}

function svSubjectName(c) {
  const id = svSubjectId(c);

  const s = SV.subjects.find(
    x => String(x.id) === String(id)
  );

  return (
    s?.name ||
    c?.subject_name ||
    c?.subject_title ||
    "Mathematics"
  );
}

function svResourceUrl(r) {
  return (
    r?.external_url ||
    r?.url ||
    r?.video_url ||
    r?.link ||
    ""
  );
}

function svResourcePath(r) {
  return (
    r?.file_path ||
    r?.storage_path ||
    r?.path ||
    r?.file ||
    ""
  );
}


/* =========================================================
   INITIALISE LEARNING DATA
   ========================================================= */

async function svInit() {

  if (SV.ready) return;

  const u = await requireAuth("index.html");

  if (!u) return;

  try {

    const [ch, rs, sub] = await Promise.all([

      sb
        .from("chapters")
        .select("*")
        .eq("is_published", true)
        .order("display_order", {
          ascending: true
        }),

      sb
        .from("resources")
        .select("*")
        .order("created_at", {
          ascending: false
        }),

      sb
        .from("subjects")
        .select("*")
        .order("name", {
          ascending: true
        })

    ]);

    if (ch.error) throw ch.error;
    if (rs.error) throw rs.error;
    if (sub.error) throw sub.error;

    SV.chapters = (ch.data || []).filter(
      c =>
        !/^number systems$/i.test(
          svChapterTitle(c)
        )
    );

    SV.resources = rs.data || [];
    SV.subjects = sub.data || [];

    SV.ready = true;

  } catch (e) {

    console.error(e);

    const root = document.getElementById("svApp");

    if (root) {

      root.innerHTML =
        '<div class="sv-empty sv-danger">' +
        'Could not load the learning library. ' +
        'Please refresh and try again.' +
        '</div>';

    }
  }
}


/* =========================================================
   COMMON HEADER
   ========================================================= */

function svHeader(title) {

  return `
    <header class="sv-top">

      <div class="sv-top-inner">

        <a
          class="sv-brand"
          href="dashboard.html"
        >
          StudyVerse <span>9</span>
        </a>

        <div class="sv-spacer"></div>

        <a href="dashboard.html">
          Dashboard
        </a>

        <button
          class="sv-btn"
          onclick="signOut()"
        >
          Sign out
        </button>

      </div>

    </header>
  `;
}


/* =========================================================
   CHAPTER CARD
   ========================================================= */

function svChapterCard(c, mode) {

  const id = encodeURIComponent(c.id);

  const qs =
    `?chapter_id=${id}`;

  const page = {
    notes: "notes.html",
    solutions: "solutions.html",
    exercises: "exercises.html",
    important: "important.html",
    videos: "videos.html",
    practice: "practice.html",
    pdf: "pdfs.html"
  }[mode] || "library.html";

  return `
    <article class="sv-card">

      <div class="sv-icon">
        ∑
      </div>

      <div class="sv-meta">
        ${svEsc(svSubjectName(c))}
        ·
        ${svEsc(svBook(c))}
        ·
        ${svEsc(svPart(c))}
      </div>

      <h3>
        ${svEsc(svChapterTitle(c))}
      </h3>

      <p>
        Select this chapter to continue to
        its ${svEsc(mode)} resources.
      </p>

      <div class="sv-actions">

        <a
          class="sv-btn primary"
          href="${page}${qs}"
        >
          Open →
        </a>

      </div>

    </article>
  `;
}


/* =========================================================
   RESOURCE CARD
   ========================================================= */

function svResourceCard(r) {

  return `
    <article class="sv-row">

      <div class="sv-row-left">

        <div class="sv-icon">
          ${svEsc(
            svResourceType(r)
              .slice(0, 1)
              .toUpperCase()
          )}
        </div>

        <div>

          <div class="sv-row-title">
            ${svEsc(svResourceTitle(r))}
          </div>

          <small>
            ${svEsc(
              svLabel(svResourceType(r))
            )}
          </small>

        </div>

      </div>

      <div class="sv-actions">

        <button
          class="sv-btn primary"
          onclick='svOpenResource(${JSON.stringify(r).replace(/</g, "\\u003c")})'
        >
          Open
        </button>

      </div>

    </article>
  `;
}


/* =========================================================
   OPEN RESOURCE
   ========================================================= */

async function svOpenResource(r) {

  try {

    await openResource(r);

  } catch (e) {

    console.error(e);

    toast(
      "Unable to open this resource.",
      "error"
    );

  }
}


/* =========================================================
   CURRENT PAGE
   ========================================================= */

function svModeFromPage() {

  const p =
    location.pathname
      .split("/")
      .pop()
      .toLowerCase();

  return p.replace(".html", "");
}


/* =========================================================
   FILTER CHAPTERS
   ========================================================= */

function svFilterChapters(mode) {

  const q = svNorm(
    svQ("q")
  );

  return SV.chapters.filter(c => {

    if (!q) return true;

    return [
      svChapterTitle(c),
      svBook(c),
      svPart(c),
      svSubjectName(c)
    ].some(v =>
      svNorm(v).includes(q)
    );

  });
}


/* =========================================================
   NOTES / SOLUTIONS / EXERCISES / ETC.
   ========================================================= */

function svRenderChapterMode(mode) {

  const root =
    document.getElementById("svApp");

  const chapterId =
    svQ("chapter_id");

  const q =
    svQ("q");

  if (chapterId) {

    const c =
      SV.chapters.find(
        x =>
          String(x.id) ===
          String(chapterId)
      );

    if (!c) {

      root.innerHTML =
        '<div class="sv-empty">' +
        'Chapter not found.' +
        '</div>';

      return;
    }

    const types = {

      notes: [
        "note",
        "notes"
      ],

      solutions: [
        "solution",
        "solutions"
      ],

      exercises: [
        "exercise",
        "exercises"
      ],

      important: [
        "important",
        "important_question",
        "important questions"
      ],

      videos: [
        "video",
        "videos"
      ],

      practice: [
        "practice",
        "practices"
      ],

      pdfs: [
        "pdf",
        "pdfs",
        "book"
      ]

    };

    const allowed =
      (types[mode] || [])
        .map(svNorm);

    let rs =
      SV.resources.filter(
        r =>
          String(
            svChapterId(r)
          ) === String(c.id)
      );

    if (allowed.length) {

      rs = rs.filter(r =>

        allowed.includes(
          svNorm(
            svResourceType(r)
          )
        )

        ||

        allowed.some(a =>
          svNorm(
            svResourceTitle(r)
          ).includes(a)
        )

      );

    }

    root.innerHTML = `

      <div class="sv-crumbs">

        <button
          onclick="history.back()"
        >
          ← Back
        </button>

        <span>/</span>

        <span>
          ${svEsc(
            svChapterTitle(c)
          )}
        </span>

      </div>

      <div class="sv-kicker">
        ${svEsc(
          svLabel(mode)
        )}
      </div>

      <h1 class="sv-title">
        ${svEsc(
          svChapterTitle(c)
        )}
      </h1>

      <p class="sv-sub">
        ${svEsc(svBook(c))}
        ·
        ${svEsc(svPart(c))}
        ·
        ${svEsc(svSubjectName(c))}
      </p>

      <section class="sv-panel">

        <div class="sv-toolbar">

          <input
            class="sv-search"
            placeholder="Filter this chapter..."
            value="${svEsc(q)}"
            oninput="svLocalFilter(this.value)"
          >

        </div>

        <div
          id="svResourceList"
          class="sv-list"
        >

          ${
            rs.length
              ? rs.map(
                  svResourceCard
                ).join("")
              : `
                <div class="sv-empty">
                  No published resources of this type
                  are available for this chapter yet.
                </div>
              `
          }

        </div>

      </section>

    `;

    return;
  }


  /* =======================================================
     CHAPTER SELECTION
     ======================================================= */

  const chapters =
    svFilterChapters(mode);

  root.innerHTML = `

    <div class="sv-kicker">
      StudyVerse 9 · Mathematics
    </div>

    <h1 class="sv-title">
      ${svEsc(
        svLabel(mode)
      )}
    </h1>

    <p class="sv-sub">
      Choose a chapter. This page is dedicated
      to ${svEsc(
        svLabel(mode)
      )}.
    </p>

    <div class="sv-toolbar">

      <input
        id="svChapterSearch"
        class="sv-search"
        placeholder="Search chapters, books or parts..."
        value="${svEsc(q)}"
        oninput="svChapterSearch(this.value)"
      >

    </div>

    <div
      id="svChapterGrid"
      class="sv-grid"
    >

      ${
        chapters.length
          ? chapters
              .map(
                c =>
                  svChapterCard(
                    c,
                    mode
                  )
              )
              .join("")
          : `
            <div class="sv-empty">
              No matching chapters found.
            </div>
          `
      }

    </div>

  `;
}


/* =========================================================
   FILTER RESOURCES INSIDE CHAPTER
   ========================================================= */

function svLocalFilter(q) {

  const mode =
    svModeFromPage();

  const cId =
    svQ("chapter_id");

  const c =
    SV.chapters.find(
      x =>
        String(x.id) ===
        String(cId)
    );

  const types = {

    notes: [
      "note",
      "notes"
    ],

    solutions: [
      "solution",
      "solutions"
    ],

    exercises: [
      "exercise",
      "exercises"
    ],

    important: [
      "important",
      "important_question",
      "important questions"
    ],

    videos: [
      "video",
      "videos"
    ],

    practice: [
      "practice",
      "practices"
    ],

    pdfs: [
      "pdf",
      "pdfs",
      "book"
    ]

  };

  const allowed =
    (types[mode] || [])
      .map(svNorm);

  let rs =
    SV.resources.filter(
      r =>
        String(
          svChapterId(r)
        ) ===
        String(c?.id)
    );

  if (allowed.length) {

    rs = rs.filter(r =>

      allowed.includes(
        svNorm(
          svResourceType(r)
        )
      )

      ||

      allowed.some(a =>
        svNorm(
          svResourceTitle(r)
        ).includes(a)
      )

    );

  }

  q =
    svNorm(q);

  if (q) {

    rs =
      rs.filter(r =>
        [
          svResourceTitle(r),
          svResourceType(r),
          r.description
        ].some(v =>
          svNorm(v).includes(q)
        )
      );

  }

  document
    .getElementById(
      "svResourceList"
    )
    .innerHTML =
      rs.length
        ? rs.map(
            svResourceCard
          ).join("")
        : `
          <div class="sv-empty">
            No matching resources.
          </div>
        `;
}


/* =========================================================
   CHAPTER SEARCH
   ========================================================= */

function svChapterSearch(q) {

  const mode =
    svModeFromPage();

  const cards =
    SV.chapters.filter(c =>
      [
        svChapterTitle(c),
        svBook(c),
        svPart(c),
        svSubjectName(c)
      ].some(v =>
        svNorm(v).includes(
          svNorm(q)
        )
      )
    );

  document
    .getElementById(
      "svChapterGrid"
    )
    .innerHTML =
      cards.length
        ? cards.map(
            c =>
              svChapterCard(
                c,
                mode
              )
          ).join("")
        : `
          <div class="sv-empty">
            No matching chapters found.
          </div>
        `;
}


/* =========================================================
   LOAD LEARNING MODE
   ========================================================= */

async function svLoadMode() {

  await svInit();

  const root =
    document.getElementById(
      "svApp"
    );

  if (
    !root ||
    !SV.ready
  ) return;

  root.innerHTML =
    '<div class="sv-loading">' +
    'Loading your learning library…' +
    '</div>';

  svRenderChapterMode(
    svModeFromPage()
  );
}


/* =========================================================
   LIBRARY
   ========================================================= */

async function svLoadLibrary() {

  await svInit();

  const root =
    document.getElementById(
      "svApp"
    );

  if (
    !root ||
    !SV.ready
  ) return;

  root.innerHTML = `

    <div class="sv-kicker">
      StudyVerse 9 · Library
    </div>

    <h1 class="sv-title">
      Choose where to learn.
    </h1>

    <p class="sv-sub">
      Subject → Book → Part → Chapter.
      Then open the learning function you need.
    </p>

    <div class="sv-grid">

      ${
        SV.chapters.map(c => `

          <article class="sv-card">

            <div class="sv-meta">
              ${svEsc(
                svSubjectName(c)
              )}
            </div>

            <h3>
              ${svEsc(
                svChapterTitle(c)
              )}
            </h3>

            <p>
              ${svEsc(
                svBook(c)
              )}
              ·
              ${svEsc(
                svPart(c)
              )}
            </p>

            <div class="sv-actions">

              <a
                class="sv-btn primary"
                href="notes.html?chapter_id=${encodeURIComponent(c.id)}"
              >
                Notes
              </a>

              <a
                class="sv-btn"
                href="solutions.html?chapter_id=${encodeURIComponent(c.id)}"
              >
                Solutions
              </a>

              <a
                class="sv-btn"
                href="exercises.html?chapter_id=${encodeURIComponent(c.id)}"
              >
                Exercises
              </a>

            </div>

          </article>

        `).join("")

      }

    </div>

  `;
}


/* =========================================================
   GLOBAL SEARCH
   ========================================================= */

async function svLoadSearch() {

  const u =
    await requireAuth(
      "index.html"
    );

  if (!u) return;

  const root =
    document.getElementById(
      "svApp"
    );

  root.innerHTML = `

    <div class="sv-kicker">
      StudyVerse 9 · Search
    </div>

    <h1 class="sv-title">
      Search the learning library.
    </h1>

    <p class="sv-sub">
      Results update as you type.
      Search uses the StudyVerse database.
    </p>

    <div class="sv-toolbar">

      <input
        id="svGlobalSearch"
        autofocus
        class="sv-search"
        placeholder="Try probability, linear, exercise, or a chapter name..."
      >

    </div>

    <div
      id="svSearchResults"
      class="sv-list"
    ></div>

  `;

  const input =
    document.getElementById(
      "svGlobalSearch"
    );

  let timer = null;

  input.addEventListener(
    "input",
    () => {

      clearTimeout(timer);

      timer =
        setTimeout(
          () =>
            svDoDatabaseSearch(
              input.value
            ),
          180
        );

    }
  );

  svDoDatabaseSearch("");
}


/* =========================================================
   CLEAN SEARCH QUERY
   ========================================================= */

function svSafeSearch(q) {

  return String(q || "")
    .replace(
      /[%_,()]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =========================================================
   DATABASE SEARCH
   ========================================================= */

async function svDoDatabaseSearch(q) {

  const box =
    document.getElementById(
      "svSearchResults"
    );

  if (!box) return;

  q =
    svSafeSearch(q);

  if (!q) {

    box.innerHTML = `
      <div class="sv-empty">
        Start typing to search published
        chapters and resources.
      </div>
    `;

    return;
  }

  box.innerHTML =
    '<div class="sv-loading">' +
    'Searching…' +
    '</div>';

  try {

    const pattern =
      `%${q}%`;

    const [ch, rs] =
      await Promise.all([

        sb
          .from("chapters")
          .select("*")
          .eq("is_published", true)
          .or(
            `name.ilike.${pattern},title.ilike.${pattern}`
          )
          .limit(20),

        sb
          .from("resources")
          .select("*")
          .or(
            `title.ilike.${pattern},name.ilike.${pattern},resource_type.ilike.${pattern}`
          )
          .limit(30)

      ]);

    if (ch.error)
      throw ch.error;

    if (rs.error)
      throw rs.error;

    const chapters =
      (ch.data || [])
        .filter(
          c =>
            !/^number systems$/i.test(
              svChapterTitle(c)
            )
        );

    const resources =
      rs.data || [];

    const chHtml =
      chapters
        .map(c => `

          <div class="sv-row">

            <div class="sv-row-left">

              <div class="sv-icon">
                ∑
              </div>

              <div>

                <div class="sv-row-title">
                  ${svEsc(
                    svChapterTitle(c)
                  )}
                </div>

                <small>
                  ${svEsc(
                    svSubjectName(c)
                  )}
                  ·
                  ${svEsc(
                    svBook(c)
                  )}
                  ·
                  ${svEsc(
                    svPart(c)
                  )}
                </small>

              </div>

            </div>

            <a
              class="sv-btn primary"
              href="notes.html?chapter_id=${encodeURIComponent(c.id)}"
            >
              Open
            </a>

          </div>

        `)
        .join("");

    const rsHtml =
      resources
        .map(
          svResourceCard
        )
        .join("");

    box.innerHTML =
      (
        chHtml +
        rsHtml
      )
      ||
      `
        <div class="sv-empty">
          No matching content yet.
        </div>
      `;

  } catch (e) {

    console.error(e);

    box.innerHTML = `
      <div class="sv-empty sv-danger">
        Search could not be completed.
        Check the published database fields
        and try again.
      </div>
    `;
  }
}


/* =========================================================
   BOOKMARKS
   ========================================================= */

async function svLoadBookmarks() {

  const u =
    await requireAuth(
      "index.html"
    );

  if (!u) return;

  const root =
    document.getElementById(
      "svApp"
    );

  try {

    const {
      data,
      error
    } =
      await sb
        .from("bookmarks")
        .select("*")
        .eq(
          "user_id",
          u.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

    if (error)
      throw error;

    root.innerHTML = `

      <div class="sv-kicker">
        StudyVerse 9 · Bookmarks
      </div>

      <h1 class="sv-title">
        Saved for later.
      </h1>

      <p class="sv-sub">
        Your saved learning resources appear here.
      </p>

      <div class="sv-list">

        ${
          (data || [])
            .map(x => `

              <div class="sv-row">

                <div>

                  <div class="sv-row-title">
                    ${svEsc(
                      x.title ||
                      x.resource_id ||
                      "Saved resource"
                    )}
                  </div>

                  <small>
                    ${svEsc(
                      x.resource_id ||
                      ""
                    )}
                  </small>

                </div>

              </div>

            `)
            .join("")

          ||

          `
            <div class="sv-empty">
              You have no bookmarks yet.
            </div>
          `
        }

      </div>

    `;

  } catch (e) {

    console.error(e);

    root.innerHTML = `
      <div class="sv-empty sv-danger">
        Could not load bookmarks.
      </div>
    `;
  }
}


/* =========================================================
   PROGRESS
   ========================================================= */

async function svLoadProgress() {

  const u =
    await requireAuth(
      "index.html"
    );

  if (!u) return;

  const root =
    document.getElementById(
      "svApp"
    );

  try {

    const {
      data,
      error
    } =
      await sb
        .from("chapter_progress")
        .select("*")
        .eq(
          "user_id",
          u.id
        );

    if (error)
      throw error;

    const done =
      new Set(
        (data || [])
          .filter(
            x => x.completed
          )
          .map(
            x =>
              String(
                x.chapter_id
              )
          )
      );

    root.innerHTML = `

      <div class="sv-kicker">
        StudyVerse 9 · Progress
      </div>

      <h1 class="sv-title">
        Your progress.
      </h1>

      <p class="sv-sub">
        Chapter completion is saved to your account.
      </p>

      <div class="sv-grid">

        ${
          SV.chapters
            .map(c => `

              <article class="sv-card">

                <div class="sv-meta">

                  ${
                    done.has(
                      String(c.id)
                    )
                      ? "Completed"
                      : "In progress"
                  }

                </div>

                <h3>
                  ${svEsc(
                    svChapterTitle(c)
                  )}
                </h3>

                <p>

                  ${
                    done.has(
                      String(c.id)
                    )
                      ? "✓ Chapter marked complete."
                      : "Keep learning and mark it complete when you finish."
                  }

                </p>

              </article>

            `)
            .join("")
        }

      </div>

    `;

  } catch (e) {

    console.error(e);

    root.innerHTML = `
      <div class="sv-empty sv-danger">
        Could not load progress.
      </div>
    `;
  }
}


/* =========================================================
   START THE CORRECT PAGE
   ========================================================= */

async function svBoot() {

  const path =
    location.pathname
      .split("/")
      .pop()
      .toLowerCase();

  const root =
    document.getElementById(
      "svApp"
    );

  if (!root) return;

  const map = {

    "library.html":
      svLoadLibrary,

    "search.html":
      svLoadSearch,

    "bookmarks.html":
      svLoadBookmarks,

    "progress.html":
      async () => {
        await svInit();
        await svLoadProgress();
      },

    "notes.html":
      svLoadMode,

    "solutions.html":
      svLoadMode,

    "exercises.html":
      svLoadMode,

    "important.html":
      svLoadMode,

    "videos.html":
      svLoadMode,

    "practice.html":
      svLoadMode,

    "pdfs.html":
      svLoadMode

  };

  const fn =
    map[path];

  if (fn)
    await fn();
}


window.addEventListener(
  "DOMContentLoaded",
  svBoot
);
