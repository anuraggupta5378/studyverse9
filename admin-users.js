let users = [];
let selectedUser = null;

(async function () {
  const access = await requireRole(["admin"]);
  if (!access) return;

  document
    .getElementById("userSearch")
    .addEventListener("input", loadUsers);

  document
    .getElementById("roleFilter")
    .addEventListener("change", renderUsers);

  document
    .getElementById("refreshUsers")
    .addEventListener("click", loadUsers);

  await loadUsers();
})();

async function loadUsers() {
  try {
    const search =
      document.getElementById("userSearch").value.trim();

    const { data, error } = await sb.rpc(
      "admin_search_users",
      {
        search_term: search || null
      }
    );

    if (error) throw error;

    users = data || [];
    renderUsers();

  } catch (error) {
    console.error(error);

    document.getElementById("userList").innerHTML = `
      <div class="empty">
        User search could not be loaded.
      </div>
    `;

    toast(error.message || "User search failed.");
  }
}

function renderUsers() {
  const role =
    document.getElementById("roleFilter").value;

  let list = users;

  if (role) {
    list = list.filter(user => user.role === role);
  }

  if (!list.length) {
    document.getElementById("userList").innerHTML = `
      <div class="empty">
        No users found.
      </div>
    `;
    return;
  }

  document.getElementById("userList").innerHTML = `
    <div class="list">
      ${list.map(user => `
        <div class="row">

          <div>
            <div class="rowtitle">
              ${esc(user.full_name || "Unnamed user")}
            </div>

            <div class="rowsub">
              ${esc(user.email || "No email")}
            </div>

            <div style="margin-top:6px">
              <span class="badge">
                ${esc(user.role || "student")}
              </span>
            </div>
          </div>

          <div class="actions">
            ${
              user.role === "admin"
                ? `<span class="badge">Protected</span>`
                : `
                  <button
                    class="btn small"
                    onclick="openRoleModal('${user.id}')"
                  >
                    Change role
                  </button>
                `
            }
          </div>

        </div>
      `).join("")}
    </div>
  `;
}

function openRoleModal(id) {
  selectedUser =
    users.find(user => user.id === id);

  if (!selectedUser) return;

  document.getElementById("roleInfo").innerHTML = `
    <strong>
      ${esc(selectedUser.full_name || "Unnamed user")}
    </strong>
    <br>
    ${esc(selectedUser.email || "")}
  `;

  document.getElementById("newRole").value =
    selectedUser.role || "student";

  document
    .getElementById("roleModal")
    .classList.add("show");
}

function closeRoleModal() {
  document
    .getElementById("roleModal")
    .classList.remove("show");

  selectedUser = null;
}

document
  .getElementById("saveRole")
  .addEventListener("click", async () => {

    if (!selectedUser) return;

    try {
      const newRole =
        document.getElementById("newRole").value;

      await sb.rpc("set_user_role", {
        target_user_id: selectedUser.id,
        new_role: newRole
      });

      toast("Role updated successfully.");

      closeRoleModal();

      await loadUsers();

    } catch (error) {
      console.error(error);
      toast(error.message || "Could not change role.");
    }
  });
