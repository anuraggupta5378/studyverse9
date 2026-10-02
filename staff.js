// ============================================================
// StudyVerse 9 — Staff Dashboard
// Phase 13.3 — Resource Upload Foundation
// ============================================================

(function () {
  "use strict";

  // ----------------------------------------------------------
  // SUPABASE CONFIGURATION
  // ----------------------------------------------------------

  const cfg = window.STUDYVERSE_CONFIG;

  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error("StudyVerse configuration is missing.");
    return;
  }

  const sb = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseKey
  );

  // ----------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------

  const $ = (id) => document.getElementById(id);

  let currentUser = null;
  let currentProfile = null;

  let subjects = [];
  let parts = [];
  let chapters = [];

  // ----------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------

  async function requireStaffAccess() {
    const {
      data: { user },
      error
    } = await sb.auth.getUser();

    if (error || !user) {
      window.location.href = "index.html";
      return null;
    }

    currentUser = user;

    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(profileError);
      alert("Unable to load your profile.");
      return null;
    }

    currentProfile = profile;

    const allowedRoles = [
      "staff",
      "manager",
      "admin"
    ];

    if (!allowedRoles.includes(profile.role)) {
      alert("You do not have permission to access the staff area.");

      window.location.href = "dashboard.html";

      return null;
    }

    return {
      user,
      profile
    };
  }

  // ----------------------------------------------------------
  // LOAD SUBJECTS
  // ----------------------------------------------------------

  async function loadSubjects() {
    const subjectSelect = $("resourceSubject");

    if (!subjectSelect) {
      console.warn(
        "resourceSubject select was not found on the page."
      );
      return;
    }

    subjectSelect.innerHTML =
      '<option value="">Select subject</option>';

    const { data, error } = await sb
      .from("subjects")
      .select(`
        id,
        name,
        slug,
        display_order
      `)
      .eq("is_active", true)
      .order("display_order", {
        ascending: true
      });

    if (error) {
      console.error("Subject loading error:", error);

      alert(
        "Could not load subjects. Please refresh the page."
      );

      return;
    }

    subjects = data || [];

    subjects.forEach((subject) => {
      const option = document.createElement("option");

      option.value = subject.id;
      option.textContent = subject.name;

      subjectSelect.appendChild(option);
    });
  }

  // ----------------------------------------------------------
  // LOAD PARTS
  //
  // There is currently NO public.parts table.
  //
  // Therefore, parts are derived from chapters.part_id.
  // ----------------------------------------------------------

  async function loadParts(subjectId) {
    const partSelect = $("resourcePart");
    const chapterSelect = $("resourceChapter");

    if (!partSelect) {
      console.warn(
        "resourcePart select was not found on the page."
      );

      return;
    }

    // Reset Part selector
    partSelect.innerHTML =
      '<option value="">Select part</option>';

    partSelect.disabled = true;

    // Reset Chapter selector
    if (chapterSelect) {
      chapterSelect.innerHTML =
        '<option value="">Select chapter</option>';

      chapterSelect.disabled = true;
    }

    parts = [];
    chapters = [];

    if (!subjectId) {
      return;
    }

    // Get chapters belonging to this subject
    const { data, error } = await sb
      .from("chapters")
      .select(`
        id,
        name,
        chapter_number,
        display_order,
        part_id
      `)
      .eq("subject_id", subjectId)
      .eq("is_published", true)
      .not("part_id", "is", null)
      .order("display_order", {
        ascending: true
      });

    if (error) {
      console.error("Part loading error:", error);

      alert(
        "Could not load curriculum parts."
      );

      return;
    }

    // --------------------------------------------------------
    // Extract unique part IDs
    // --------------------------------------------------------

    const uniquePartIds = [];

    (data || []).forEach((chapter) => {
      if (
        chapter.part_id &&
        !uniquePartIds.includes(chapter.part_id)
      ) {
        uniquePartIds.push(chapter.part_id);
      }
    });

    // --------------------------------------------------------
    // Create Part objects
    //
    // Since there is no parts table, the display name is
    // temporarily generated from the order.
    // --------------------------------------------------------

    parts = uniquePartIds.map((partId, index) => {
      return {
        id: partId,
        name: `Part ${index + 1}`
      };
    });

    // --------------------------------------------------------
    // Add parts to selector
    // --------------------------------------------------------

    parts.forEach((part) => {
      const option = document.createElement("option");

      option.value = part.id;
      option.textContent = part.name;

      partSelect.appendChild(option);
    });

    partSelect.disabled = parts.length === 0;

    // Helpful empty state
    if (parts.length === 0) {
      partSelect.innerHTML =
        '<option value="">No parts available</option>';
    }
  }

  // ----------------------------------------------------------
  // LOAD CHAPTERS
  // ----------------------------------------------------------

  async function loadChapters(subjectId, partId) {
    const chapterSelect = $("resourceChapter");

    if (!chapterSelect) {
      console.warn(
        "resourceChapter select was not found on the page."
      );

      return;
    }

    chapterSelect.innerHTML =
      '<option value="">Select chapter</option>';

    chapterSelect.disabled = true;

    chapters = [];

    if (!subjectId || !partId) {
      return;
    }

    const { data, error } = await sb
      .from("chapters")
      .select(`
        id,
        name,
        chapter_number,
        description,
        display_order,
        part_id
      `)
      .eq("subject_id", subjectId)
      .eq("part_id", partId)
      .eq("is_published", true)
      .order("display_order", {
        ascending: true
      });

    if (error) {
      console.error(
        "Chapter loading error:",
        error
      );

      alert(
        "Could not load chapters."
      );

      return;
    }

    chapters = data || [];

    // --------------------------------------------------------
    // Add chapters
    // --------------------------------------------------------

    chapters.forEach((chapter) => {
      const option = document.createElement("option");

      option.value = chapter.id;

      let label = "";

      if (chapter.chapter_number !== null) {
        label +=
          `Chapter ${chapter.chapter_number} — `;
      }

      label += chapter.name;

      option.textContent = label;

      chapterSelect.appendChild(option);
    });

    chapterSelect.disabled = chapters.length === 0;

    if (chapters.length === 0) {
      chapterSelect.innerHTML =
        '<option value="">No chapters available</option>';
    }
  }

  // ----------------------------------------------------------
  // SELECTOR EVENTS
  // ----------------------------------------------------------

  function setupCurriculumSelectors() {
    const subjectSelect = $("resourceSubject");
    const partSelect = $("resourcePart");

    // Subject changed
    if (subjectSelect) {
      subjectSelect.addEventListener(
        "change",
        async function () {
          const subjectId = this.value;

          await loadParts(subjectId);
        }
      );
    }

    // Part changed
    if (partSelect) {
      partSelect.addEventListener(
        "change",
        async function () {
          const subjectId =
            subjectSelect
              ? subjectSelect.value
              : "";

          const partId = this.value;

          await loadChapters(
            subjectId,
            partId
          );
        }
      );
    }
  }

  // ----------------------------------------------------------
  // SELECTED CHAPTER HELPER
  // ----------------------------------------------------------

  function getSelectedChapter() {
    const chapterSelect = $("resourceChapter");

    if (!chapterSelect) {
      return null;
    }

    const chapterId = chapterSelect.value;

    if (!chapterId) {
      return null;
    }

    return (
      chapters.find(
        (chapter) =>
          chapter.id === chapterId
      ) || null
    );
  }

  // ----------------------------------------------------------
  // GET SELECTED CURRICULUM
  // ----------------------------------------------------------

  function getSelectedCurriculum() {
    const subjectSelect =
      $("resourceSubject");

    const partSelect =
      $("resourcePart");

    const chapterSelect =
      $("resourceChapter");

    const subject =
      subjects.find(
        (item) =>
          item.id ===
          (subjectSelect
            ? subjectSelect.value
            : "")
      ) || null;

    const part =
      parts.find(
        (item) =>
          item.id ===
          (partSelect
            ? partSelect.value
            : "")
      ) || null;

    const chapter =
      getSelectedChapter();

    return {
      subject,
      part,
      chapter
    };
  }

  // ----------------------------------------------------------
  // DEBUG HELPER
  // ----------------------------------------------------------

  window.getStudyVerseCurriculum =
    function () {
      const result =
        getSelectedCurriculum();

      console.log(
        "Selected StudyVerse curriculum:",
        result
      );

      return result;
    };

  // ----------------------------------------------------------
  // SIGN OUT
  // ----------------------------------------------------------

  async function signOutStaff() {
    try {
      await sb.auth.signOut();

      window.location.href =
        "index.html";
    } catch (error) {
      console.error(
        "Sign out error:",
        error
      );
    }
  }

  // Make available to HTML buttons
  window.signOutStaff =
    signOutStaff;

  // ----------------------------------------------------------
  // INITIALISE STAFF PAGE
  // ----------------------------------------------------------

  async function initStaffPage() {
    const access =
      await requireStaffAccess();

    if (!access) {
      return;
    }

    setupCurriculumSelectors();

    await loadSubjects();

    console.log(
      "StudyVerse 9 Staff page ready.",
      access.profile
    );
  }

  // ----------------------------------------------------------
  // START
  // ----------------------------------------------------------

  document.addEventListener(
    "DOMContentLoaded",
    initStaffPage
  );

})();
