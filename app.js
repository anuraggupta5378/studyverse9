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

async function signOut(){
  await sb.auth.signOut();
  location.href = "index.html";
}

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
      window.open(u,"_blank","noopener");
      return;
    }catch(e){
      console.error(e);
    }
  }

  const u = resourceUrl(r);

  if(u){
    window.open(u,"_blank","noopener");
  }else{
    toast(
      "This resource has no file or external link yet.",
      "error"
    );
  }
}

async function fetchChapters(){
  const {data,error} = await sb
    .from("chapters")
    .select("*")
    .eq("is_published",true)
    .order("display_order",{ascending:true});

  if(error) throw error;

  return (data || []).filter(
    c => !/^number systems$/i.test((c.name || "").trim())
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

async function fetchResources(){
  const {data,error} = await sb
    .from("resources")
    .select("*")
    .order("created_at",{ascending:false});

  if(error) throw error;

  return data || [];
}

function setUserUI(profile){
  document
    .querySelectorAll("[data-user-name]")
    .forEach(e =>
      e.textContent = profile?.full_name || "Student"
    );

  document
    .querySelectorAll("[data-user-email]")
    .forEach(e =>
      e.textContent = profile?.email || ""
    );
}
