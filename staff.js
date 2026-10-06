// ============================================================
// StudyVerse 9 — Staff Resource Manager
// Phase 13.3D
// Curriculum + Resource Creation + File Upload
// ============================================================

(function () {
  "use strict";

  // ----------------------------------------------------------
  // CONFIG
  // ----------------------------------------------------------

  const cfg = window.STUDYVERSE_CONFIG;

  if (
    !cfg ||
    !cfg.supabaseUrl ||
    !cfg.supabaseKey
  ) {
    console.error(
      "StudyVerse configuration is missing."
    );
    return;
  }

  const sb = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseKey
  );

  const $ = (id) =>
    document.getElementById(id);

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  let currentUser = null;
  let currentProfile = null;

  let subjects = [];
  let parts = [];
  let chapters = [];

  let selectedFiles = [];

  // ----------------------------------------------------------
  // BASIC HELPERS
  // ----------------------------------------------------------

  function showStatus(
    message,
    type = "loading"
  ) {
    const status =
      $("resourceStatus");

    if (!status) return;

    status.textContent = message;

    status.className =
      "sv-status show " + type;
  }

  function clearStatus() {
    const status =
      $("resourceStatus");

    if (!status) return;

    status.textContent = "";

    status.className =
      "sv-status";
  }

  function safeFileName(name) {
    return name
      .replace(/[^\w.\-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .substring(0, 180);
  }

  function getFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
      return (
        (bytes / 1024).toFixed(1) +
        " KB"
      );
    }

    if (bytes < 1024 * 1024 * 1024) {
      return (
        (bytes / (1024 * 1024)).toFixed(1) +
        " MB"
      );
    }

    return (
      (bytes / (1024 * 1024 * 1024)).toFixed(1) +
      " GB"
    );
  }

  // ----------------------------------------------------------
  // AUTH
  // ----------------------------------------------------------

  async function requireStaffAccess() {
    const {
      data: {
        user
      },
      error
    } = await sb.auth.getUser();

    if (error || !user) {
      window.location.href =
        "index.html";

      return null;
    }

    currentUser = user;

    const {
      data: profile,
      error: profileError
    } = await sb
      .from("profiles")
      .select(
        "id, full_name, role"
      )
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile
    ) {
      console.error(
        profileError
      );

      alert(
        "Unable to load your profile."
      );

      return null;
    }

    currentProfile =
      profile;

    const allowedRoles = [
      "staff",
      "manager",
      "admin"
    ];

    if (
      !allowedRoles.includes(
        profile.role
      )
    ) {
      alert(
        "You do not have permission to access this page."
      );

      window.location.href =
        "dashboard.html";

      return null;
    }

    return {
      user,
      profile
    };
  }

  // ----------------------------------------------------------
  // SUBJECTS
  // ----------------------------------------------------------

  async function loadSubjects() {
    const select =
      $("resourceSubject");

    if (!select) return;

    select.innerHTML =
      '<option value="">Select subject</option>';

    const {
      data,
      error
    } = await sb
      .from("subjects")
      .select(
        "id, name, slug, display_order"
      )
      .eq(
        "is_active",
        true
      )
      .order(
        "display_order",
        {
          ascending: true
        }
      );

    if (error) {
      console.error(
        "Subjects:",
        error
      );

      alert(
        "Could not load subjects."
      );

      return;
    }

    subjects =
      data || [];

    subjects.forEach(
      (subject) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          subject.id;

        option.textContent =
          subject.name;

        select.appendChild(
          option
        );
      }
    );
  }

  // ----------------------------------------------------------
  // PARTS
  //
  // No public.parts table exists.
  // Parts are derived from chapters.part_id.
  // ----------------------------------------------------------

  async function loadParts(
    subjectId
  ) {
    const partSelect =
      $("resourcePart");

    const chapterSelect =
      $("resourceChapter");

    if (!partSelect) return;

    partSelect.innerHTML =
      '<option value="">Select part</option>';

    partSelect.disabled =
      true;

    if (chapterSelect) {
      chapterSelect.innerHTML =
        '<option value="">Select chapter</option>';

      chapterSelect.disabled =
        true;
    }

    parts = [];
    chapters = [];

    if (!subjectId) {
      return;
    }

    const {
      data,
      error
    } = await sb
      .from("chapters")
      .select(`
        id,
        name,
        chapter_number,
        display_order,
        part_id
      `)
      .eq(
        "subject_id",
        subjectId
      )
      .eq(
        "is_published",
        true
      )
      .not(
        "part_id",
        "is",
        null
      )
      .order(
        "display_order",
        {
          ascending: true
        }
      );

    if (error) {
      console.error(
        "Parts:",
        error
      );

      alert(
        "Could not load curriculum parts."
      );

      return;
    }

    const uniquePartIds =
      [];

    (data || []).forEach(
      (chapter) => {
        if (
          chapter.part_id &&
          !uniquePartIds.includes(
            chapter.part_id
          )
        ) {
          uniquePartIds.push(
            chapter.part_id
          );
        }
      }
    );

    parts =
      uniquePartIds.map(
        (partId, index) => ({
          id: partId,
          name:
            `Part ${index + 1}`
        })
      );

    parts.forEach(
      (part) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          part.id;

        option.textContent =
          part.name;

        partSelect.appendChild(
          option
        );
      }
    );

    if (
      parts.length === 0
    ) {
      partSelect.innerHTML =
        '<option value="">No parts available</option>';

      return;
    }

    partSelect.disabled =
      false;
  }

  // ----------------------------------------------------------
  // CHAPTERS
  // ----------------------------------------------------------

  async function loadChapters(
    subjectId,
    partId
  ) {
    const select =
      $("resourceChapter");

    if (!select) return;

    select.innerHTML =
      '<option value="">Select chapter</option>';

    select.disabled =
      true;

    chapters = [];

    if (
      !subjectId ||
      !partId
    ) {
      return;
    }

    const {
      data,
      error
    } = await sb
      .from("chapters")
      .select(`
        id,
        name,
        chapter_number,
        description,
        display_order,
        part_id
      `)
      .eq(
        "subject_id",
        subjectId
      )
      .eq(
        "part_id",
        partId
      )
      .eq(
        "is_published",
        true
      )
      .order(
        "display_order",
        {
          ascending: true
        }
      );

    if (error) {
      console.error(
        "Chapters:",
        error
      );

      alert(
        "Could not load chapters."
      );

      return;
    }

    chapters =
      data || [];

    chapters.forEach(
      (chapter) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          chapter.id;

        const number =
          chapter.chapter_number != null
            ? `Chapter ${chapter.chapter_number} — `
            : "";

        option.textContent =
          number +
          chapter.name;

        select.appendChild(
          option
        );
      }
    );

    select.disabled =
      chapters.length === 0;
  }

  // ----------------------------------------------------------
  // CURRICULUM EVENTS
  // ----------------------------------------------------------

  function setupCurriculum() {
    const subject =
      $("resourceSubject");

    const part =
      $("resourcePart");

    if (subject) {
      subject.addEventListener(
        "change",
        async () => {
          await loadParts(
            subject.value
          );
        }
      );
    }

    if (part) {
      part.addEventListener(
        "change",
        async () => {
          await loadChapters(
            subject
              ? subject.value
              : "",
            part.value
          );
        }
      );
    }
  }

  // ----------------------------------------------------------
  // FILE SELECTION
  // ----------------------------------------------------------

  function setupFileSelection() {
    const input =
      $("resourceFiles");

    if (!input) return;

    input.addEventListener(
      "change",
      () => {
        const incoming =
          Array.from(
            input.files || []
          );

        incoming.forEach(
          (file) => {
            const exists =
              selectedFiles.some(
                (existing) =>
                  existing.name ===
                    file.name &&
                  existing.size ===
                    file.size &&
                  existing.lastModified ===
                    file.lastModified
              );

            if (!exists) {
              selectedFiles.push(
                file
              );
            }
          }
        );

        input.value = "";

        renderFiles();
      }
    );
  }

  // ----------------------------------------------------------
  // FILE PREVIEW
  // ----------------------------------------------------------

  function renderFiles() {
    const container =
      $("selectedFiles");

    if (!container) return;

    container.innerHTML = "";

    selectedFiles.forEach(
      (file, index) => {
        const item =
          document.createElement(
            "div"
          );

        item.className =
          "sv-file-item";

        const preview =
          document.createElement(
            "div"
          );

        preview.className =
          "sv-file-preview";

        if (
          file.type.startsWith(
            "image/"
          )
        ) {
          const img =
            document.createElement(
              "img"
            );

          img.src =
            URL.createObjectURL(
              file
            );

          img.alt =
            file.name;

          preview.appendChild(
            img
          );
        } else if (
          file.type.startsWith(
            "video/"
          )
        ) {
          const video =
            document.createElement(
              "video"
            );

          video.src =
            URL.createObjectURL(
              file
            );

          video.muted =
            true;

          video.preload =
            "metadata";

          preview.appendChild(
            video
          );
        } else {
          preview.textContent =
            file.type ===
            "application/pdf"
              ? "📄"
              : "📎";
        }

        const info =
          document.createElement(
            "div"
          );

        const name =
          document.createElement(
            "div"
          );

        name.className =
          "sv-file-name";

        name.textContent =
          file.name;

        const size =
          document.createElement(
            "div"
          );

        size.className =
          "sv-file-size";

        size.textContent =
          getFileSize(
            file.size
          );

        info.appendChild(
          name
        );

        info.appendChild(
          size
        );

        const remove =
          document.createElement(
            "button"
          );

        remove.type =
          "button";

        remove.className =
          "sv-remove";

        remove.textContent =
          "Remove";

        remove.addEventListener(
          "click",
          () => {
            selectedFiles.splice(
              index,
              1
            );

            renderFiles();
          }
        );

        item.appendChild(
          preview
        );

        item.appendChild(
          info
        );

        item.appendChild(
          remove
        );

        container.appendChild(
          item
        );
      }
    );
  }

  // ----------------------------------------------------------
  // VALIDATE FILES
  // ----------------------------------------------------------

  function validateFiles() {
    const allowedTypes = [
      "application/pdf"
    ];

    for (
      const file of selectedFiles
    ) {
      const valid =
        allowedTypes.includes(
          file.type
        ) ||
        file.type.startsWith(
          "image/"
        ) ||
        file.type.startsWith(
          "video/"
        );

      if (!valid) {
        return {
          valid: false,
          message:
            `${file.name} is not a supported file type.`
        };
      }
    }

    return {
      valid: true
    };
  }

  // ----------------------------------------------------------
  // GET FORM DATA
  // ----------------------------------------------------------

  function getFormData() {
    return {
      subjectId:
        $("resourceSubject")
          ? $("resourceSubject")
              .value
          : "",

      partId:
        $("resourcePart")
          ? $("resourcePart")
              .value
          : "",

      chapterId:
        $("resourceChapter")
          ? $("resourceChapter")
              .value
          : "",

      resourceType:
        $("resourceType")
          ? $("resourceType")
              .value
          : "notes",

      title:
        $("resourceTitle")
          ? $("resourceTitle")
              .value
              .trim()
          : "",

      description:
        $("resourceDescription")
          ? $("resourceDescription")
              .value
              .trim()
          : ""
    };
  }

  // ----------------------------------------------------------
  // VALIDATE RESOURCE
  // ----------------------------------------------------------

  function validateResource(
    form
  ) {
    if (!form.subjectId) {
      return {
        valid: false,
        message:
          "Please select a subject."
      };
    }

    if (!form.partId) {
      return {
        valid: false,
        message:
          "Please select a part."
      };
    }

    if (!form.chapterId) {
      return {
        valid: false,
        message:
          "Please select a chapter."
      };
    }

    if (!form.title) {
      return {
        valid: false,
        message:
          "Please enter a resource title."
      };
    }

    if (
      form.title.length < 2
    ) {
      return {
        valid: false,
        message:
          "Resource title is too short."
      };
    }

    return {
      valid: true
    };
  }

  // ----------------------------------------------------------
  // CREATE RESOURCE
  // ----------------------------------------------------------

  async function createResource(
    form
  ) {
    const {
      data,
      error
    } = await sb
      .from("resources")
      .insert({
        chapter_id:
          form.chapterId,

        title:
          form.title,

        resource_type:
          form.resourceType,

        description:
          form.description ||
          null,

        content:
          null,

        file_path:
          null,

        external_url:
          null,

        is_published:
          false,

        created_by:
          currentUser.id,

        updated_by:
          currentUser.id
      })
      .select(
        "id, title, chapter_id, resource_type"
      )
      .single();

    if (error) {
      console.error(
        "Resource creation:",
        error
      );

      throw new Error(
        error.message ||
          "Could not create resource."
      );
    }

    return data;
  }

  // ----------------------------------------------------------
  // UPLOAD ONE FILE
  // ----------------------------------------------------------

  async function uploadFile(
    resource,
    file
  ) {
    const cleanName =
      safeFileName(
        file.name
      );

    const storagePath =
      `resources/${currentUser.id}/${resource.id}/${crypto.randomUUID()}-${cleanName}`;

    const {
      data,
      error
    } = await sb.storage
      .from(
        cfg.storageBucket
      )
      .upload(
        storagePath,
        file,
        {
          upsert: false,
          contentType:
            file.type ||
            "application/octet-stream"
        }
      );

    if (error) {
      console.error(
        "Storage upload:",
        error
      );

      throw new Error(
        `Upload failed for ${file.name}: ${error.message}`
      );
    }

    return {
      storagePath:
        data.path ||
        storagePath,

      originalName:
        file.name,

      mimeType:
        file.type ||
        null,

      sizeBytes:
        file.size
    };
  }

  // ----------------------------------------------------------
  // SAVE ATTACHMENT RECORD
  // ----------------------------------------------------------

  async function saveAttachment(
    resourceId,
    uploaded
  ) {
    const {
      data,
      error
    } = await sb
      .from(
        "resource_files"
      )
      .insert({
        resource_id:
          resourceId,

        storage_path:
          uploaded.storagePath,

        original_name:
          uploaded.originalName,

        mime_type:
          uploaded.mimeType,

        size_bytes:
          uploaded.sizeBytes,

        uploaded_by:
          currentUser.id
      })
      .select(
        "id, storage_path"
      )
      .single();

    if (error) {
      console.error(
        "Attachment record:",
        error
      );

      throw new Error(
        `Could not save attachment ${uploaded.originalName}: ${error.message}`
      );
    }

    return data;
  }

  // ----------------------------------------------------------
  // UPDATE PRIMARY FILE
  // ----------------------------------------------------------

  async function setPrimaryFile(
    resourceId,
    storagePath
  ) {
    const {
      error
    } = await sb
      .from("resources")
      .update({
        file_path:
          storagePath,

        updated_by:
          currentUser.id
      })
      .eq(
        "id",
        resourceId
      );

    if (error) {
      console.error(
        "Primary file update:",
        error
      );

      throw new Error(
        "The file uploaded, but the resource could not save its primary file path."
      );
    }
  }

  // ----------------------------------------------------------
  // SUBMIT FOR REVIEW
  // ----------------------------------------------------------

  async function submitForReview(
    resource,
    form
  ) {
    const {
      data,
      error
    } = await sb
      .from(
        "resource_change_requests"
      )
      .insert({
        resource_id:
          resource.id,

        submitted_by:
          currentUser.id,

        action:
          "create",

        title:
          form.title,

        resource_type:
          form.resourceType,

        description:
          form.description ||
          null,

        content:
          null,

        file_path:
          resource.file_path ||
          null,

        external_url:
          null,

        chapter_id:
          form.chapterId,

        status:
          "pending"
      })
      .select(
        "id, status"
      )
      .single();

    if (error) {
      console.error(
        "Review request:",
        error
      );

      throw new Error(
        `Resource was created, but review submission failed: ${error.message}`
      );
    }

    return data;
  }

  // ----------------------------------------------------------
  // MAIN SAVE FUNCTION
  // ----------------------------------------------------------

  async function saveResource(
    submitReview
  ) {
    clearStatus();

    const form =
      getFormData();

    const validation =
      validateResource(
        form
      );

    if (!validation.valid) {
      showStatus(
        validation.message,
        "error"
      );

      return;
    }

    const fileValidation =
      validateFiles();

    if (
      !fileValidation.valid
    ) {
      showStatus(
        fileValidation.message,
        "error"
      );

      return;
    }

    const saveButton =
      $("saveDraftButton");

    const submitButton =
      $("submitResourceButton");

    if (saveButton) {
      saveButton.disabled =
        true;
    }

    if (submitButton) {
      submitButton.disabled =
        true;
    }

    let resource = null;

    const uploadedPaths = [];

    try {
      showStatus(
        "Creating resource draft...",
        "loading"
      );

      resource =
        await createResource(
          form
        );

      // ------------------------------------------------------
      // UPLOAD ATTACHMENTS
      // ------------------------------------------------------

      for (
        let i = 0;
        i < selectedFiles.length;
        i++
      ) {
        const file =
          selectedFiles[i];

        showStatus(
          `Uploading file ${i + 1} of ${selectedFiles.length}: ${file.name}`,
          "loading"
        );

        const uploaded =
          await uploadFile(
            resource,
            file
          );

        uploadedPaths.push(
          uploaded.storagePath
        );

        await saveAttachment(
          resource.id,
          uploaded
        );

        // First attachment becomes primary file
        if (i === 0) {
          await setPrimaryFile(
            resource.id,
            uploaded.storagePath
          );

          resource.file_path =
            uploaded.storagePath;
        }
      }

      // ------------------------------------------------------
      // SUBMIT FOR REVIEW
      // ------------------------------------------------------

      if (submitReview) {
        showStatus(
          "Submitting resource for review...",
          "loading"
        );

        await submitForReview(
          resource,
          form
        );
      }

      // ------------------------------------------------------
      // SUCCESS
      // ------------------------------------------------------

      if (submitReview) {
        showStatus(
          "Resource submitted successfully for review.",
          "success"
        );
      } else {
        showStatus(
          "Resource draft saved successfully.",
          "success"
        );
      }

      resetResourceForm();

    } catch (error) {
      console.error(
        "Resource save error:",
        error
      );

      showStatus(
        error.message ||
          "Something went wrong while saving the resource.",
        "error"
      );
    } finally {
      if (saveButton) {
        saveButton.disabled =
          false;
      }

      if (submitButton) {
        submitButton.disabled =
          false;
      }
    }
  }

  // ----------------------------------------------------------
  // RESET FORM
  // ----------------------------------------------------------

  function resetResourceForm() {
    if ($("resourceTitle")) {
      $("resourceTitle").value =
        "";
    }

    if (
      $("resourceDescription")
    ) {
      $("resourceDescription")
        .value = "";
    }

    selectedFiles = [];

    renderFiles();

    if ($("resourceFiles")) {
      $("resourceFiles").value =
        "";
    }
  }

  // ----------------------------------------------------------
  // BUTTONS
  // ----------------------------------------------------------

  function setupButtons() {
    const save =
      $("saveDraftButton");

    const submit =
      $("submitResourceButton");

    if (save) {
      save.addEventListener(
        "click",
        () => {
          saveResource(false);
        }
      );
    }

    if (submit) {
      submit.addEventListener(
        "click",
        () => {
          saveResource(true);
        }
      );
    }
  }

  // ----------------------------------------------------------
  // SIGN OUT
  // ----------------------------------------------------------

  async function signOutStaff() {
    await sb.auth.signOut();

    window.location.href =
      "index.html";
  }

  window.signOutStaff =
    signOutStaff;

  // ----------------------------------------------------------
  // DEBUG / CURRICULUM HELPER
  // ----------------------------------------------------------

  window.getStudyVerseCurriculum =
    function () {
      const subject =
        $("resourceSubject")
          ? $("resourceSubject")
              .value
          : "";

      const part =
        $("resourcePart")
          ? $("resourcePart")
              .value
          : "";

      const chapter =
        $("resourceChapter")
          ? $("resourceChapter")
              .value
          : "";

      console.log({
        subjectId:
          subject,

        partId:
          part,

        chapterId:
          chapter
      });

      return {
        subjectId:
          subject,

        partId:
          part,

        chapterId:
          chapter
      };
    };

  // ----------------------------------------------------------
  // INITIALISE
  // ----------------------------------------------------------

  async function initStaffPage() {
    const access =
      await requireStaffAccess();

    if (!access) {
      return;
    }

    setupCurriculum();

    setupFileSelection();

    setupButtons();

    await loadSubjects();

    console.log(
      "StudyVerse 9 Staff Resource Manager ready."
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
