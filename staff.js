// StudyVerse 9 — Staff Resource Upload
// Phase 13.3A

(function () {
  "use strict";

  const cfg = window.STUDYVERSE_CONFIG;

  if (!cfg || !cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error("StudyVerse configuration missing.");
    return;
  }

  const sb = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseKey
  );

  const $ = (id) => document.getElementById(id);

  let subjects = [];
  let parts = [];
  let chapters = [];

  /* -----------------------------
     AUTH
  ----------------------------- */

  async function requireStaffAccess() {
    const {
      data: { user },
      error
    } = await sb.auth.getUser();

    if (error || !user) {
      window.location.href = "index.html";
      return null;
    }

    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      alert("Unable to load your profile.");
      return null;
    }

    if (!["staff", "manager", "admin"].includes(profile.role)) {
      alert("You do not have permission to access this page.");
      window.location.href = "dashboard.html";
      return null;
    }

    return { user, profile };
  }

  /* -----------------------------
     LOAD SUBJECTS
  ----------------------------- */

  async function loadSubjects() {
    const select = $("resourceSubject");

    if (!select) return;

    select.innerHTML =
      '<option value="">Select subject</option>';

    const { data, error } = await sb
      .from("subjects")
      .select("id, name, slug, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error(error);
      alert("Could not load subjects.");
      return;
    }

    subjects = data || [];

    subjects.forEach((subject) => {
      const option = document.createElement("option");

      option.value = subject.id;
      option.textContent = subject.name;

      select.appendChild(option);
    });
  }

  /* -----------------------------
     LOAD PARTS
  ----------------------------- */

  async function loadParts(subjectId) {
    const partSelect = $("resourcePart");
    const chapterSelect = $("resourceChapter");

    if (!partSelect) return;

    partSelect.innerHTML =
      '<option value="">Select part</option>';

    if (chapterSelect) {
      chapterSelect.innerHTML =
        '<option value="">Select chapter</option>';
      chapterSelect.disabled = true;
    }

    partSelect.disabled = true;

    if (!subjectId) return;

    /*
      chapters.part_id references the curriculum part.

      We obtain the available parts through the
      chapters belonging to the selected subject.
    */

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
      .order("display_order", { ascending: true });

    if (error) {
      console.error(error);
      alert("Could not load curriculum parts.");
      return;
    }

    const uniqueParts = [];
    const seen = new Set();

    (data || []).forEach((chapter) => {
      if (!seen.has(chapter.part_id)) {
        seen.add(chapter.part_id);

        uniqueParts.push({
          id: chapter.part_id,
          name: "Part " + (uniqueParts.length + 1)
        });
      }
    });

    parts = uniqueParts;

    parts.forEach((part) => {
      const option = document.createElement("option");

      option.value = part.id;
      option.textContent = part.name;

      partSelect.appendChild(option);
    });

    partSelect.disabled = parts.length === 0;
  }

  /* -----------------------------
     LOAD CHAPTERS
  ----------------------------- */

  async function loadChapters(subjectId, partId) {
    const chapterSelect = $("resourceChapter");

    if (!chapterSelect) return;

    chapterSelect.innerHTML =
      '<option value="">Select chapter</option>';

    chapterSelect.disabled = true;

    if (!subjectId || !partId) return;

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
      .eq("part_id", partId)
      .eq("is_published", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error(error);
      alert("Could not load chapters.");
      return;
    }

    chapters = data || [];

    chapters.forEach((chapter) => {
      const option = document.createElement("option");

      option.value = chapter.id;

      const number =
        chapter.chapter_number != null
          ? `Chapter ${chapter.chapter_number} — `
          : "";

      option.textContent = number + chapter.name;

      chapterSelect.appendChild(option);
    });

    chapterSelect.disabled = chapters.length === 0;
  }

  /* -----------------------------
     EVENTS
  ----------------------------- */

  function setupCurriculumSelectors() {
    const subject = $("resourceSubject");
    const part = $("resourcePart");

    if (subject) {
      subject.addEventListener("change", () => {
        loadParts(subject.value);
      });
    }

    if (part) {
      part.addEventListener("change", () => {
        loadChapters(
          subject ? subject.value : "",
          part.value
        );
      });
    }
  }

  /* -----------------------------
     START
  ----------------------------- */

  async function init() {
    const access = await requireStaffAccess();

    if (!access) return;

    setupCurriculumSelectors();
    await loadSubjects();
  }

  document.addEventListener("DOMContentLoaded", init);

})();
