
import { useCallback, useEffect, useMemo, useState } from "react";
import CardHeader from "../components/CardHeader";
import { authService } from "../services/authService";

const EMPTY_FORM = {
  fullName: "",
  email: "",
  password: "",
  role: "analyst",
};

function RoleBadge({ role }) {
  const label = {
    admin: "Controller",
    supervisor: "Supervisor",
    analyst: "Analyst",
  }[role] || role;

  return <span className={`um-role um-role-${role}`}>{label}</span>;
}

function StatusBadge({ active }) {
  return (
    <span className={`um-status ${active ? "active" : "inactive"}`}>
      <span />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function UserManagement({ onShowToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await authService.getUsers();
      setUsers(result);
    } catch (err) {
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const counts = useMemo(() => ({
    total: users.length,
    analysts: users.filter((u) => u.role === "analyst").length,
    supervisors: users.filter((u) => u.role === "supervisor").length,
    active: users.filter((u) => u.isActive !== false).length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !term ||
        user.fullName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term);

      const matchesRole =
        roleFilter === "all" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      onShowToast?.("Please complete all required fields.", "warning");
      return;
    }

    if (form.password.length < 8) {
      onShowToast?.("Password must contain at least 8 characters.", "warning");
      return;
    }

    setSaving(true);

    try {
      const result = await authService.createUser({
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
      });

      setUsers((current) => [
        result.user,
        ...current.filter((user) => user.id !== result.user?.id),
      ]);

      setForm(EMPTY_FORM);
      setShowCreate(false);
      onShowToast?.("User account created successfully.", "success");
    } catch (err) {
      onShowToast?.(err.message || "Unable to create user.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (user, role) => {
    if (role === user.role) return;

    setUpdatingId(user.id);

    try {
      const result = await authService.updateUser(user.id, { role });

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? result.user : item
        )
      );

      onShowToast?.("User role updated successfully.", "success");
    } catch (err) {
      onShowToast?.(err.message || "Unable to update role.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (user) => {
    const nextStatus = user.isActive === false;

    setUpdatingId(user.id);

    try {
      const result = await authService.updateUser(user.id, {
        isActive: nextStatus,
      });

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? result.user : item
        )
      );

      onShowToast?.(
        nextStatus ? "Account activated." : "Account deactivated.",
        "success"
      );
    } catch (err) {
      onShowToast?.(err.message || "Unable to update account.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>CONTROLLER CONSOLE</label>
          <h1>User Management</h1>
          <p>
            Create accounts, assign roles and manage access to the MeterIQ
            platform.
          </p>
        </div>

        <button
          className="primary"
          onClick={() => setShowCreate(true)}
        >
          + Create User
        </button>
      </section>

      <section className="stats um-stats">
        <article className="stat">
          <div className="stat-top">Total Users</div>
          <div className="stat-value">{counts.total}</div>
          <div className="stat-label">Registered accounts</div>
        </article>

        <article className="stat">
          <div className="stat-top">Analysts</div>
          <div className="stat-value">{counts.analysts}</div>
          <div className="stat-label">Data review access</div>
        </article>

        <article className="stat">
          <div className="stat-top">Supervisors</div>
          <div className="stat-value">{counts.supervisors}</div>
          <div className="stat-label">Investigation management</div>
        </article>

        <article className="stat">
          <div className="stat-top">Active Accounts</div>
          <div className="stat-value">{counts.active}</div>
          <div className="stat-label">Currently enabled</div>
        </article>
      </section>

      <section className="card um-card">
        <CardHeader
          title="Registered users"
          text="Manage the people who can access MeterIQ"
          right={
            <button
              className="secondary action-btn"
              onClick={loadUsers}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          }
        />

        <div className="um-toolbar">
          <input
            type="search"
            placeholder="Search name or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="all">All roles</option>
            <option value="analyst">Analysts</option>
            <option value="supervisor">Supervisors</option>
            <option value="admin">Controllers</option>
          </select>
        </div>

        {error && (
          <div className="um-error" role="alert">
            {error}
            <button className="secondary" onClick={loadUsers}>
              Retry
            </button>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Access actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="empty-table-cell">
                    Loading user accounts…
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-table-cell">
                    {users.length === 0
                      ? "No user accounts found. Create an account to get started."
                      : "No users match your search."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.fullName || "Unnamed user"}</strong>
                    </td>

                    <td>{user.email}</td>

                    <td>
                      <RoleBadge role={user.role} />
                    </td>

                    <td>
                      <StatusBadge active={user.isActive !== false} />
                    </td>

                    <td>
                      {user.role === "admin" ? (
                        <span className="muted-text">
                          Controller protected
                        </span>
                      ) : (
                        <div className="um-actions">
                          <select
                            aria-label={`Change role for ${user.fullName}`}
                            value={user.role}
                            disabled={updatingId === user.id}
                            onChange={(event) =>
                              handleRoleChange(user, event.target.value)
                            }
                          >
                            <option value="analyst">Analyst</option>
                            <option value="supervisor">Supervisor</option>
                          </select>

                          <button
                            className={
                              user.isActive === false
                                ? "secondary"
                                : "um-danger-btn"
                            }
                            disabled={updatingId === user.id}
                            onClick={() => handleStatusChange(user)}
                          >
                            {updatingId === user.id
                              ? "Saving…"
                              : user.isActive === false
                                ? "Activate"
                                : "Deactivate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="panel-footnote">
          Controller accounts are protected from modification through this
          interface. Role changes and account status are enforced by the API.
        </p>
      </section>

      {showCreate && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowCreate(false);
            }
          }}
        >
          <section className="modal-card um-create-modal">
            <div className="modal-header">
              <h3>Create MeterIQ account</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowCreate(false)}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="modal-body um-form">
                <label>
                  Full name
                  <input
                    value={form.fullName}
                    onChange={(event) =>
                      updateForm("fullName", event.target.value)
                    }
                    placeholder="Enter full name"
                    required
                  />
                </label>

                <label>
                  Email address
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateForm("email", event.target.value)
                    }
                    placeholder="name@company.com"
                    required
                  />
                </label>

                <label>
                  Temporary password
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      updateForm("password", event.target.value)
                    }
                    placeholder="At least 8 characters"
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <label>
                  Assign role
                  <select
                    value={form.role}
                    onChange={(event) =>
                      updateForm("role", event.target.value)
                    }
                  >
                    <option value="analyst">Analyst</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </label>

                <p className="muted-text">
                  New accounts are active immediately. Only the Controller
                  can create accounts or change assigned roles.
                </p>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary"
                  disabled={saving}
                >
                  {saving ? "Creating…" : "Create Account"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
