/* StudyVerse 9 — shared client */

const { createClient } = window.supabase;
const cfg = window.STUDYVERSE_CONFIG;
const sb = createClient(cfg.supabaseUrl, cfg.supabaseKey);

const GM_CHAPTERS = [
  {n:1, name:"Orienting Yourself: The Use of Coordinates"},
  {n:2, name:"Introduction to Linear Polynomials"},
  {n:3, name:"The World of Numbers"},
  {n:4, name:"Exploring Algebraic Identities"},
  {n:5, name:"I’m Up and Down, and Round and Round"},
  {n:6, name:"Measuring Space: Perimeter and Area"},
  {n:7, name:"The Mathematics of Maybe: Introduction to Probability"},
  {n:8, name:"Predicting What Comes Next: Exploring Sequences and Progressions"}
];


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function esc(v=""){
  return String(v).replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#039;"
  }[m]));
}


function slugify(s=""){
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"");
}


function toast(msg, type="ok"){
  const el = document.getElementById("toast");

  if(!el) return;

  el.textContent = msg;
  el.dataset.type = type;
  el.classList.add("show");

  clearTimeout(window.__toast);

  window.__toast = setTimeout(
    () => el.classList.remove("show"),
    3200
  );
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function currentUser(){
  const {data:{user}} = await sb.auth.getUser();
  return user;
}


async function profileOf(userId){
  const {data,error} = await sb
    .from("profiles")
    .select("*")
    .eq("id",userId)
    .maybeSingle();

  if(error) throw error;

  return data;
}


async function requireAuth(redirect="index.html"){
  const user = await currentUser();

  if(!user){
    location.href = redirect;
    return null;
  }

  return user;
}


async function requireRole(roles){
  const user = await requireAuth();

  if(!user) return null;

  const p = await profileOf(user.id);

  if(!p || !roles.includes(p.role)){
    location.href = "dashboard.html";
    return null;
  }

  return {
    user,
    profile:p
  };
}


/* =========================================================
   ACTIVITY SESSION TRACKING
   ========================================================= */

let studyVerseActivitySessionId = null;
let studyVerseActivityTimer = null;


/*
  Generate a persistent browser-tab identifier.

  sessionStorage means:
  - it survives normal page navigation in the same tab
  - it disappears when that browser tab/session is closed
*/

function getStudyVerseBrowserSessionId(){

  const key = "studyverse_browser_session_id";

  let id = sessionStorage.getItem(key);

  if(!id){

    if(window.crypto && crypto.randomUUID){
      id = crypto.randomUUID();
    }else{
      id =
        Date.now().toString(36) +
        Math.random().toString(36).slice(2);
    }

    sessionStorage.setItem(key,id);
  }

  return id;
}


/*
  Start a database activity session.

  We deliberately don't let the browser choose the role.
  The database function reads the authenticated user's
  actual role.
*/

async function startActivitySession(){

  try{

    const {data,error} = await sb.rpc(
      "start_activity_session"
    );

    if(error) throw error;

    studyVerseActivitySessionId = data;

    sessionStorage.setItem(
      "studyverse_activity_session_id",
      data
    );

    return data;

  }catch(error){

    console.error(
      "StudyVerse activity session could not start:",
      error
    );

    return null;
  }
}


/*
  Recover an existing activity session from this tab.
*/

function getSavedActivitySessionId(){

  return sessionStorage.getItem(
    "studyverse_activity_session_id"
  );
}


/*
  Update last_seen_at.
*/

async function touchActivitySession(){

  const id =
    studyVerseActivitySessionId ||
    getSavedActivitySessionId();

  if(!id) return;

  try{

    const {error} = await sb.rpc(
      "touch_activity_session",
      {
        session_id:id
      }
    );

    if(error) throw error;

  }catch(error){

    console.error(
      "StudyVerse activity heartbeat failed:",
      error
    );
  }
}


/*
  End the current activity session.
*/

async function endActivitySession(){

  const id =
    studyVerseActivitySessionId ||
    getSavedActivitySessionId();

  if(!id) return;

  try{

    const {error} = await sb.rpc(
      "end_activity_session",
      {
        session_id:id
      }
    );

    if(error) throw error;

  }catch(error){

    console.error(
      "StudyVerse activity session could not end:",
      error
    );

  }finally{

    studyVerseActivitySessionId = null;

    sessionStorage.removeItem(
      "studyverse_activity_session_id"
    );
  }
}


/*
  Start activity tracking for an authenticated user.

  If a session already exists in this browser tab,
  we simply continue using it.
*/

async function initActivityTracking(){

  try{

    const user = await currentUser();

    if(!user) return;

    const saved =
      getSavedActivitySessionId();

    if(saved){

      studyVerseActivitySessionId = saved;

      await touchActivitySession();

    }else{

      await startActivitySession();
    }

    /*
      Heartbeat every 60 seconds.
    */

    clearInterval(studyVerseActivityTimer);

    studyVerseActivityTimer = setInterval(
      touchActivitySession,
      60000
    );

  }catch(error){

    console.error(
      "StudyVerse activity tracking error:",
      error
    );
  }
}


/* =========================================================
   WEBSITE VISIT TRACKING
   ========================================================= */

async function recordSiteVisit(){

  try{

    const user = await currentUser();

    if(!user) return;

    const browserSessionId =
      getStudyVerseBrowserSessionId();

    const page =
      location.pathname.split("/").pop() ||
      "index.html";

    const {error} = await sb.rpc(
      "record_site_visit",
      {
        visit_page:page,
        visit_session_id:browserSessionId
      }
    );

    if(error) throw error;

  }catch(error){

    /*
      Analytics must never stop the learning website
      from working.
    */

    console.error(
      "StudyVerse visit tracking failed:",
      error
    );
  }
}


/* =========================================================
   SIGN OUT
   ========================================================= */

async function signOut(){

  /*
    Try to close the activity session before signing out.
  */

  await endActivitySession();

  clearInterval(studyVerseActivityTimer);

  await sb.auth.signOut();

  location.href = "index.html";
}


/* =========================================================
   STORAGE / RESOURCE HELPERS
   ========================================================= */

async function signedFile(path, expires=900){

  const {data,error} = await sb.storage
    .from(cfg.storageBucket)
    .createSignedUrl(path,expires);

  if(error) throw error;

  return data.signedUrl;
}


function resourceType(r){

  return r.resource_type ||
         r.type ||
         r.kind ||
         "resource";
}


function resourcePath(r){

  return r.file_path ||
         r.storage_path ||
         r.path ||
         r.file ||
         "";
}


function resourceUrl(r){

  return r.external_url ||
         r.url ||
         r.video_url ||
         r.link ||
         "";
}


async function openResource(r){

  const path = resourcePath(r);

  if(path){

    try{

      const u = await signedFile(path);

      window.open(
        u,
        "_blank",
        "noopener"
      );

      return;

    }catch(e){

      console.error(e);
    }
  }

  const u = resourceUrl(r);

  if(u){

    window.open(
      u,
      "_blank",
      "noopener"
    );

  }else{

    toast(
      "This resource has no file or external link yet.",
      "error"
    );
  }
}


/* =========================================================
   CHAPTERS
   ========================================================= */

async function fetchChapters(){

  const {data,error} = await sb
    .from("chapters")
    .select("*")
    .eq("is_published",true)
    .order("display_order",{ascending:true});

  if(error) throw error;

  return (data || []).filter(
    c =>
      !/^number systems$/i.test(
        (c.name || "").trim()
      )
  );
}


async function fetchAllChapters(){

  const {data,error} = await sb
    .from("chapters")
    .select("*")
    .order("display_order",{ascending:true});

  if(error) throw error;

  return data || [];
}


/* =========================================================
   RESOURCES
   ========================================================= */

async function fetchResources(){

  const {data,error} = await sb
    .from("resources")
    .select("*")
    .order("created_at",{ascending:false});

  if(error) throw error;

  return data || [];
}


/* =========================================================
   USER UI
   ========================================================= */

function setUserUI(profile){

  document
    .querySelectorAll("[data-user-name]")
    .forEach(e =>
      e.textContent =
        profile?.full_name || "Student"
    );

  document
    .querySelectorAll("[data-user-email]")
    .forEach(e =>
      e.textContent =
        profile?.email || ""
    );
}


/* =========================================================
   AUTOMATIC INITIALIZATION
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    /*
      Start analytics only after the page is loaded.
      Failure here never blocks the website.
    */

    try{

      await initActivityTracking();

      await recordSiteVisit();

    }catch(error){

      console.error(
        "StudyVerse analytics initialization failed:",
        error
      );
    }
  }
);


/*
  If the page becomes hidden, send a final heartbeat.

  We do NOT forcibly end the session here because
  changing tabs/apps should not incorrectly terminate
  an active study session.
*/

document.addEventListener(
  "visibilitychange",
  () => {

    if(document.visibilityState === "hidden"){

      touchActivitySession();

    }else if(document.visibilityState === "visible"){

      touchActivitySession();
    }
  }
);


/*
  Best-effort final heartbeat when leaving the page.
*/

window.addEventListener(
  "pagehide",
  () => {

    touchActivitySession();

  }
);
