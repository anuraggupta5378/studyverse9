/* =========================================================
   StudyVerse 9 — Learning Pages Engine
   ========================================================= */

(function () {

  "use strict";

  const SV = {
    chapters: [],
    resources: [],
    ready: false
  };

  window.SV = SV;


  /* -------------------------------------------------------
     Helpers
     ------------------------------------------------------- */

  function esc(value = "") {
    return String(value).replace(/[&<>"']/g, function (m) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[m];
    });
  }

  function norm(value = "") {
    return String(value || "").trim().toLowerCase();
  }

  function param(name) {
    return new URLSearchParams(
      window.location.search
    ).get(name) || "";
  }

  function pageName() {
    return location.pathname
      .split("/")
      .pop()
      .toLowerCase()
      .replace(".html", "");
  }

  function chapterTitle(c) {
    return c?.name ||
           c?.title ||
           c?.chapter_name ||
           "Untitled chapter";
  }

  function resourceTitle(r) {
    return r?.title ||
           r?.name ||
           r?.resource_name ||
           "Untitled resource";
  }

  function resourceType(r) {
    return r?.resource_type ||
           r?.type ||
           r?.kind ||
           "resource";
  }

  function resourceChapterId(r) {
    return r?.chapter_id ||
           r?.chapter ||
           r?.chapterId ||
           "";
  }

  function resourcePath(r) {
    return r?.file_path ||
           r?.storage_path ||
           r?.path ||
           r?.file ||
           "";
  }

  function resourceUrl(r) {
    return r?.external_url ||
           r?.url ||
           r?.video_url ||
           r?.link ||
           "";
  }


  /* -------------------------------------------------------
     Header
     ------------------------------------------------------- */

  window.svHeader = function () {

    return `
      <header class="sv-top">

        <div class="sv-top-inner">

          <a
            href="dashboard.html"
            class="sv-brand"
          >
            StudyVerse <span>9</span>
          </a>

          <div class="sv-spacer"></div>

          <a href="dashboard.html">
            Dashboard
          </a>

          <button
            class="sv-btn"
            onclick="svLogout()"
          >
            Sign out
          </button>

        </div>

      </header>
    `;
  };


  window.svLogout = async function () {

    try {

      await sb.auth.signOut();

    } finally {

      location.href = "index.html";

    }

  };


  /* -------------------------------------------------------
     Load database
     ------------------------------------------------------- */

  async function init() {

    if (SV.ready) {
      return true;
    }

    const root =
      document.getElementById("svApp");

    try {

      if (
        typeof sb === "undefined"
      ) {
        throw new Error(
          "Supabase client was not loaded."
        );
      }


      const user =
        await currentUser();

      if (!user) {

        location.href = "index.html";

        return false;
      }


      /* Only load the two tables this
         learning system actually needs. */

      const chapterResult =
        await sb
          .from("chapters")
          .select("*")
          .eq("is_published", true)
          .order(
            "display_order",
            { ascending: true }
          );


      if (chapterResult.error) {
        throw chapterResult.error;
      }


      const resourceResult =
        await sb
          .from("resources")
          .select("*")
          .order(
            "created_at",
            { ascending: false }
          );


      if (resourceResult.error) {
        throw resourceResult.error;
      }


      SV.chapters =
        (chapterResult.data || [])
          .filter(function (c) {

            return !/^number systems$/i.test(
              chapterTitle(c)
            );

          });


      SV.resources =
        resourceResult.data || [];


      SV.ready = true;

      return true;

    } catch (error) {

      console.error(
        "StudyVerse learning engine:",
        error
      );


      if (root) {

        root.innerHTML = `

          <div class="sv-empty sv-danger">

            <h3>
              We couldn't load this page.
            </h3>

            <p>
              Please refresh the page.
            </p>

            <button
              class="sv-btn primary"
              onclick="location.reload()"
            >
              Refresh
            </button>

          </div>

        `;

      }

      return false;
    }

  }


  /* -------------------------------------------------------
     Resource opening
     ------------------------------------------------------- */

  window.svOpenResource = async function (resource) {

    try {

      const path =
        resourcePath(resource);

      if (path) {

        const url =
          await signedFile(path);

        window.open(
          url,
          "_blank",
          "noopener"
        );

        return;
      }


      const url =
        resourceUrl(resource);

      if (url) {

        window.open(
          url,
          "_blank",
          "noopener"
        );

        return;
      }


      if (typeof toast === "function") {

        toast(
          "This resource has no file or link yet.",
          "error"
        );

      }

    } catch (error) {

      console.error(error);

      if (typeof toast === "function") {

        toast(
          "Unable to open this resource.",
          "error"
        );

      }

    }

  };


  /* -------------------------------------------------------
     Chapter card
     ------------------------------------------------------- */

  function chapterCard(chapter, mode) {

    const id =
      encodeURIComponent(
        chapter.id
      );

    const target =
      `${mode}.html?chapter_id=${id}`;


    return `

      <article class="sv-card">

        <div class="sv-icon">
          ∑
        </div>

        <div class="sv-meta">
          MATHEMATICS · GANITA MANJARI
        </div>

        <h3>
          ${esc(
            chapterTitle(chapter)
          )}
        </h3>

        <p>
          Select this chapter to open its
          ${esc(mode)} resources.
        </p>

        <div class="sv-actions">

          <a
            class="sv-btn primary"
            href="${target}"
          >
            Open →
          </a>

        </div>

      </article>

    `;
  }


  /* -------------------------------------------------------
     Resource card
     ------------------------------------------------------- */

  function resourceCard(resource) {

    return `

      <article class="sv-row">

        <div class="sv-row-left">

          <div class="sv-icon">
            ${esc(
              resourceType(resource)
                .charAt(0)
                .toUpperCase()
            )}
          </div>

          <div>

            <div class="sv-row-title">
              ${esc(
                resourceTitle(resource)
              )}
            </div>

            <small>
              ${esc(
                resourceType(resource)
              )}
            </small>

          </div>

        </div>

        <button
          class="sv-btn primary"
          onclick='svOpenResource(${JSON.stringify(resource).replace(/</g, "\\u003c")})'
        >
          Open
        </button>

      </article>

    `;
  }


  /* -------------------------------------------------------
     Learning page
     ------------------------------------------------------- */

  async function loadLearningPage() {

    const root =
      document.getElementById(
        "svApp"
      );

    if (!root) {
      return;
    }


    const loaded =
      await init();

    if (!loaded) {
      return;
    }


    const mode =
      pageName();


    const chapterId =
      param("chapter_id");


    /* -----------------------------------------------------
       Chapter selected
       ----------------------------------------------------- */

    if (chapterId) {

      const chapter =
        SV.chapters.find(function (c) {

          return String(c.id) ===
                 String(chapterId);

        });


      if (!chapter) {

        root.innerHTML = `

          <div class="sv-empty">

            <h3>
              Chapter not found
            </h3>

            <a
              class="sv-btn primary"
              href="${mode}.html"
            >
              Back
            </a>

          </div>

        `;

        return;
      }


      let resources =
        SV.resources.filter(function (r) {

          return String(
            resourceChapterId(r)
          ) === String(chapter.id);

        });


      const search =
        norm(param("q"));


      if (search) {

        resources =
          resources.filter(function (r) {

            return [

              resourceTitle(r),
              resourceType(r),
              r.description

            ].some(function (value) {

              return norm(value)
                .includes(search);

            });

          });

      }


      root.innerHTML = `

        <div class="sv-crumbs">

          <a
            href="${mode}.html"
          >
            ← Back to ${esc(mode)}
          </a>

        </div>

        <div class="sv-kicker">
          STUDYVERSE 9 · MATHEMATICS
        </div>

        <h1 class="sv-title">
          ${esc(
            chapterTitle(chapter)
          )}
        </h1>

        <p class="sv-sub">
          ${esc(
            mode.charAt(0).toUpperCase() +
            mode.slice(1)
          )}
        </p>


        <div class="sv-toolbar">

          <input
            id="svLocalSearch"
            class="sv-search"
            placeholder="Search within this chapter..."
            value="${esc(search)}"
          >

        </div>


        <div
          id="svResourceList"
          class="sv-list"
        >

          ${
            resources.length
              ? resources
                  .map(resourceCard)
                  .join("")
              : `

                <div class="sv-empty">

                  <h3>
                    No ${esc(mode)}
                    available yet
                  </h3>

                  <p>
                    This chapter is ready for content.
                    Resources will appear here when
                    they are published.
                  </p>

                </div>

              `
          }

        </div>

      `;


      const input =
        document.getElementById(
          "svLocalSearch"
        );


      if (input) {

        input.addEventListener(
          "input",
          function () {

            const q =
              norm(input.value);


            const filtered =
              resources.filter(function (r) {

                return [

                  resourceTitle(r),
                  resourceType(r),
                  r.description

                ].some(function (value) {

                  return norm(value)
                    .includes(q);

                });

              });


            document
              .getElementById(
                "svResourceList"
              )
              .innerHTML =
                filtered.length
                  ? filtered
                      .map(resourceCard)
                      .join("")
                  : `
                    <div class="sv-empty">
                      No matching resources.
                    </div>
                  `;

          }
        );

      }


      return;
    }


    /* -----------------------------------------------------
       Chapter selection
       ----------------------------------------------------- */

    let chapters =
      SV.chapters.slice();


    const query =
      norm(param("q"));


    if (query) {

      chapters =
        chapters.filter(function (c) {

          return [

            chapterTitle(c),
            c.book_name,
            c.book,
            c.part_name,
            c.part

          ].some(function (value) {

            return norm(value)
              .includes(query);

          });

        });

    }


    root.innerHTML = `

      <div class="sv-kicker">
        STUDYVERSE 9 · MATHEMATICS
      </div>

      <h1 class="sv-title">
        ${esc(
          mode.charAt(0).toUpperCase() +
          mode.slice(1)
        )}
      </h1>

      <p class="sv-sub">
        Choose a chapter to continue.
      </p>


      <div class="sv-toolbar">

        <input
          id="svChapterSearch"
          class="sv-search"
          placeholder="Search chapters..."
          value="${esc(query)}"
        >

      </div>


      <div
        id="svChapterGrid"
        class="sv-grid"
      >

        ${
          chapters.length
            ? chapters
                .map(function (c) {

                  return chapterCard(
                    c,
                    mode
                  );

                })
                .join("")
            : `

              <div class="sv-empty">

                No matching chapters found.

              </div>

            `
        }

      </div>

    `;


    const searchBox =
      document.getElementById(
        "svChapterSearch"
      );


    if (searchBox) {

      searchBox.addEventListener(
        "input",
        function () {

          const q =
            norm(searchBox.value);


          const filtered =
            SV.chapters.filter(
              function (c) {

                return [

                  chapterTitle(c),
                  c.book_name,
                  c.book,
                  c.part_name,
                  c.part

                ].some(function (value) {

                  return norm(value)
                    .includes(q);

                });

              }
            );


          document
            .getElementById(
              "svChapterGrid"
            )
            .innerHTML =
              filtered.length
                ? filtered
                    .map(function (c) {

                      return chapterCard(
                        c,
                        mode
                      );

                    })
                    .join("")
                : `

                  <div class="sv-empty">
                    No matching chapters found.
                  </div>

                `;

        }
      );

    }

  }


  /* -------------------------------------------------------
     Library page
     ------------------------------------------------------- */

  async function loadLibrary() {

    const root =
      document.getElementById(
        "svApp"
      );

    if (!root) return;


    const loaded =
      await init();

    if (!loaded) return;


    root.innerHTML = `

      <div class="sv-kicker">
        STUDYVERSE 9 · LIBRARY
      </div>

      <h1 class="sv-title">
        Learning Library
      </h1>

      <p class="sv-sub">
        Choose a chapter and then choose
        exactly how you want to learn.
      </p>


      <div class="sv-grid">

        ${
          SV.chapters.map(function (c) {

            const id =
              encodeURIComponent(c.id);

            return `

              <article class="sv-card">

                <div class="sv-meta">
                  MATHEMATICS · GANITA MANJARI
                </div>

                <h3>
                  ${esc(
                    chapterTitle(c)
                  )}
                </h3>

                <div class="sv-actions">

                  <a
                    class="sv-btn primary"
                    href="notes.html?chapter_id=${id}"
                  >
                    Notes
                  </a>

                  <a
                    class="sv-btn"
                    href="solutions.html?chapter_id=${id}"
                  >
                    Solutions
                  </a>

                  <a
                    class="sv-btn"
                    href="exercises.html?chapter_id=${id}"
                  >
                    Exercises
                  </a>

                </div>

              </article>

            `;

          }).join("")

        }

      </div>

    `;

  }


  /* -------------------------------------------------------
     Search page
     ------------------------------------------------------- */

  async function loadSearch() {

    const root =
      document.getElementById(
        "svApp"
      );

    if (!root) return;


    const loaded =
      await init();

    if (!loaded) return;


    root.innerHTML = `

      <div class="sv-kicker">
        STUDYVERSE 9 · SEARCH
      </div>

      <h1 class="sv-title">
        Search everything.
      </h1>

      <p class="sv-sub">
        Start typing and matching chapters
        and resources will appear.
      </p>


      <input
        id="svGlobalSearch"
        class="sv-search"
        autofocus
        placeholder="Search chapters, notes, exercises..."
      >


      <div
        id="svSearchResults"
        class="sv-list"
      >

        <div class="sv-empty">
          Start typing to search.
        </div>

      </div>

    `;


    const input =
      document.getElementById(
        "svGlobalSearch"
      );


    input.addEventListener(
      "input",
      function () {

        const q =
          norm(input.value);


        if (!q) {

          document
            .getElementById(
              "svSearchResults"
            )
            .innerHTML = `
              <div class="sv-empty">
                Start typing to search.
              </div>
            `;

          return;
        }


        const chapterResults =
          SV.chapters.filter(
            function (c) {

              return [

                chapterTitle(c),
                c.book_name,
                c.book,
                c.part_name,
                c.part

              ].some(function (value) {

                return norm(value)
                  .includes(q);

              });

            }
          );


        const resourceResults =
          SV.resources.filter(
            function (r) {

              return [

                resourceTitle(r),
                resourceType(r),
                r.description

              ].some(function (value) {

                return norm(value)
                  .includes(q);

              });

            }
          );


        const html = `

          ${
            chapterResults
              .map(function (c) {

                return `

                  <div class="sv-row">

                    <div class="sv-row-left">

                      <div class="sv-icon">
                        ∑
                      </div>

                      <div>

                        <div class="sv-row-title">
                          ${esc(
                            chapterTitle(c)
                          )}
                        </div>

                        <small>
                          Chapter
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

                `;

              })
              .join("")

          }


          ${
            resourceResults
              .map(resourceCard)
              .join("")
          }


          ${
            !chapterResults.length &&
            !resourceResults.length
              ? `
                <div class="sv-empty">
                  No matching content found.
                </div>
              `
              : ""
          }

        `;


        document
          .getElementById(
            "svSearchResults"
          )
          .innerHTML = html;

      }
    );

  }


  /* -------------------------------------------------------
     Bookmarks
     ------------------------------------------------------- */

  async function loadBookmarks() {

    const root =
      document.getElementById(
        "svApp"
      );

    if (!root) return;


    const user =
      await currentUser();


    if (!user) {

      location.href =
        "index.html";

      return;
    }


    root.innerHTML = `

      <div class="sv-kicker">
        STUDYVERSE 9
      </div>

      <h1 class="sv-title">
        Bookmarks
      </h1>

      <p class="sv-sub">
        Your saved resources.
      </p>

      <div class="sv-empty">
        Bookmark display will connect to your
        saved resources here.
      </div>

    `;

  }


  /* -------------------------------------------------------
     Progress
     ------------------------------------------------------- */

  async function loadProgress() {

    const root =
      document.getElementById(
        "svApp"
      );

    if (!root) return;


    const loaded =
      await init();

    if (!loaded) return;


    const user =
      await currentUser();


    const result =
      await sb
        .from("chapter_progress")
        .select("*")
        .eq(
          "user_id",
          user.id
        );


    if (result.error) {

      console.error(
        result.error
      );

      root.innerHTML = `
        <div class="sv-empty sv-danger">
          Could not load progress.
        </div>
      `;

      return;
    }


    const completed =
      new Set(
        (result.data || [])
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
        STUDYVERSE 9 · PROGRESS
      </div>

      <h1 class="sv-title">
        Your Progress
      </h1>

      <div class="sv-grid">

        ${
          SV.chapters.map(function (c) {

            const done =
              completed.has(
                String(c.id)
              );

            return `

              <article class="sv-card">

                <div class="sv-meta">
                  ${
                    done
                      ? "✓ COMPLETED"
                      : "IN PROGRESS"
                  }
                </div>

                <h3>
                  ${esc(
                    chapterTitle(c)
                  )}
                </h3>

              </article>

            `;

          }).join("")

        }

      </div>

    `;

  }


  /* -------------------------------------------------------
     Boot
     ------------------------------------------------------- */

  async function boot() {

    const root =
      document.getElementById(
        "svApp"
      );

    if (!root) return;


    const path =
      pageName();


    try {

      if (path === "library") {

        await loadLibrary();

      } else if (path === "search") {

        await loadSearch();

      } else if (path === "bookmarks") {

        await loadBookmarks();

      } else if (path === "progress") {

        await loadProgress();

      } else {

        await loadLearningPage();

      }

    } catch (error) {

      console.error(
        "StudyVerse boot error:",
        error
      );


      root.innerHTML = `

        <div class="sv-empty sv-danger">

          <h3>
            Something went wrong.
          </h3>

          <p>
            Please refresh the page.
          </p>

          <button
            class="sv-btn primary"
            onclick="location.reload()"
          >
            Refresh
          </button>

        </div>

      `;

    }

  }


  /* -------------------------------------------------------
     Start after page is ready
     ------------------------------------------------------- */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      boot
    );

  } else {

    boot();

  }

})();
