"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import { AppPage } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFooterActions } from "@/components/ui/modal-footer";
import { Modal } from "@/components/ui/Modal";
import { NativeSelect } from "@/components/ui/native-select";
import { ROLE_LABELS, type AppModule, type EmployeeRole } from "@/lib/auth/types";
import {
  EDITABLE_ROLES,
  EMPLOYEE_ROLES,
  type Employee,
  type RoleAccessGrant,
  type RoleAccessPayload,
} from "@/lib/employees/types";
import { groupModulesBySection } from "@/lib/modules/navigation";
import { useSyncedState } from "@/lib/realtime/use-synced-state";

type EmployeesRolesClientProps = {
  context: AppContext;
  initialEmployees: Employee[];
  initialRoleAccess: RoleAccessPayload;
};

type EmployeeForm = {
  fullName: string;
  phone: string;
  role: EmployeeRole;
  pin: string;
};

const emptyForm: EmployeeForm = {
  fullName: "",
  phone: "",
  role: "picker",
  pin: "",
};

function grantKey(role: EmployeeRole, moduleId: string) {
  return `${role}:${moduleId}`;
}

function grantsToSet(grants: RoleAccessGrant[]) {
  return new Set(grants.map((g) => grantKey(g.role, g.moduleId)));
}

export function EmployeesRolesClient({
  context,
  initialEmployees,
  initialRoleAccess,
}: EmployeesRolesClientProps) {
  const router = useRouter();
  const [modules] = useState<AppModule[]>(initialRoleAccess.modules);
  const [grantSet, setGrantSet] = useState(() =>
    grantsToSet(initialRoleAccess.grants),
  );
  const [accessDirty, setAccessDirty] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessSaved, setAccessSaved] = useState(false);

  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const pauseEmployeeSync = modalOpen || pinModalOpen;
  const [employees, setEmployees] = useSyncedState(
    initialEmployees,
    !pauseEmployeeSync,
  );

  useEffect(() => {
    if (accessDirty) return;
    setGrantSet(grantsToSet(initialRoleAccess.grants));
  }, [initialRoleAccess.grants, accessDirty]);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [pinTarget, setPinTarget] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pinError, setPinError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedPinIds, setRevealedPinIds] = useState<Set<string>>(
    () => new Set(),
  );

  const displayed = useMemo(() => {
    return employees
      .filter((e) => (tab === "active" ? e.isActive : !e.isActive))
      .filter((e) => {
        if (!search) return true;
        const q = search.toLowerCase().trim();
        return (
          e.fullName.toLowerCase().includes(q) ||
          e.phone.toLowerCase().includes(q) ||
          ROLE_LABELS[e.role].toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [employees, tab, search]);

  const activeCount = employees.filter((e) => e.isActive).length;
  const inactiveCount = employees.filter((e) => !e.isActive).length;
  const sections = useMemo(() => groupModulesBySection(modules), [modules]);

  function openAddModal() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(employee: Employee) {
    setEditing(employee);
    setForm({
      fullName: employee.fullName,
      phone: employee.phone,
      role: employee.role,
      pin: "",
    });
    setError("");
    setModalOpen(true);
  }

  function openPinModal(employee: Employee) {
    setPinTarget(employee);
    setNewPin("");
    setPinError("");
    setPinModalOpen(true);
  }

  async function copyPin(employee: Employee) {
    if (!employee.pin) return;
    try {
      await navigator.clipboard.writeText(employee.pin);
      setCopiedId(employee.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore clipboard failures
    }
  }

  function togglePinVisibility(employeeId: string) {
    setRevealedPinIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  function renderPinCell(employee: Employee) {
    if (!employee.pin) {
      return (
        <span className="font-mono text-sm tabular-nums text-muted">
          Not set
        </span>
      );
    }

    const revealed = revealedPinIds.has(employee.id);

    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm tabular-nums tracking-wider">
          {revealed ? employee.pin : "••••••"}
        </span>
        <button
          type="button"
          onClick={() => togglePinVisibility(employee.id)}
          className="text-xs text-muted underline underline-offset-2"
        >
          {revealed ? "Hide" : "Show"}
        </button>
        {revealed && (
          <button
            type="button"
            onClick={() => void copyPin(employee)}
            className="text-xs text-muted underline underline-offset-2"
          >
            {copiedId === employee.id ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    );
  }

  async function handleSaveEmployee() {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const res = await fetch(`/api/admin/employees/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            phone: form.phone,
            role: form.role,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to update");
        setEmployees((prev) =>
          prev.map((e) => (e.id === editing.id ? data.employee : e)),
        );
      } else {
        const res = await fetch("/api/admin/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.fullName,
            phone: form.phone,
            role: form.role,
            pin: form.pin,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create");
        setEmployees((prev) => [...prev, data.employee]);
      }
      setModalOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(employee: Employee) {
    if (togglingId) return;
    setTogglingId(employee.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !employee.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update status");
      setEmployees((prev) =>
        prev.map((e) => (e.id === employee.id ? data.employee : e)),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleResetPin() {
    if (!pinTarget) return;
    setSaving(true);
    setPinError("");
    try {
      const res = await fetch(
        `/api/admin/employees/${pinTarget.id}/reset-pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: newPin }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reset PIN");
      setEmployees((prev) =>
        prev.map((e) => (e.id === pinTarget.id ? data.employee : e)),
      );
      setPinModalOpen(false);
      router.refresh();
    } catch (e) {
      setPinError(e instanceof Error ? e.message : "Failed to reset PIN");
    } finally {
      setSaving(false);
    }
  }

  function hasAccess(role: EmployeeRole, moduleId: string) {
    if (role === "admin") return true;
    return grantSet.has(grantKey(role, moduleId));
  }

  function toggleAccess(role: EmployeeRole, moduleId: string) {
    if (role === "admin") return;
    setAccessDirty(true);
    setAccessSaved(false);
    setAccessError("");
    setGrantSet((prev) => {
      const next = new Set(prev);
      const key = grantKey(role, moduleId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSaveAccess() {
    setSavingAccess(true);
    setAccessError("");
    setAccessSaved(false);
    try {
      const grants: RoleAccessGrant[] = [];
      for (const role of EDITABLE_ROLES) {
        for (const mod of modules) {
          if (grantSet.has(grantKey(role, mod.id))) {
            grants.push({ role, moduleId: mod.id });
          }
        }
      }

      const res = await fetch("/api/admin/role-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grants }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save access");

      setGrantSet(grantsToSet(data.grants as RoleAccessGrant[]));
      setAccessDirty(false);
      setAccessSaved(true);
    } catch (e) {
      setAccessError(e instanceof Error ? e.message : "Failed to save access");
    } finally {
      setSavingAccess(false);
    }
  }

  return (
    <>
      <AppPage
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Employees & Roles" },
        ]}
      >
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Employees & Roles
            </h1>
            <p className="mt-1 text-sm text-muted">
              Manage staff PINs and which modules each role can access
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90 sm:w-auto"
          >
            <span className="text-lg leading-none">+</span>
            Add employee
          </button>
        </div>

        {error && !modalOpen && (
          <p
            className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-medium">Employees</h2>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex w-full rounded-lg border border-border bg-surface p-0.5 sm:w-auto">
              <button
                type="button"
                onClick={() => setTab("active")}
                className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none sm:px-4 sm:py-1.5 ${
                  tab === "active"
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setTab("inactive")}
                className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none sm:px-4 sm:py-1.5 ${
                  tab === "inactive"
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Inactive ({inactiveCount})
              </button>
            </div>

            <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 sm:ml-auto sm:max-w-xs sm:py-2 lg:min-w-[220px]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-muted"
                aria-hidden
              >
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" />
                <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <input
                type="search"
                placeholder="Search by name, phone, or role"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </div>
          </div>

          {displayed.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
              No employees found
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {displayed.map((employee) => (
                  <article
                    key={employee.id}
                    className="rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{employee.fullName}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {employee.phone}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          employee.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-sidebar text-muted"
                        }`}
                      >
                        {employee.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      {ROLE_LABELS[employee.role]}
                    </p>
                    <div className="mt-2">{renderPinCell(employee)}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(employee)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-sidebar"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openPinModal(employee)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-sidebar"
                      >
                        Reset PIN
                      </button>
                      <button
                        type="button"
                        disabled={togglingId === employee.id}
                        onClick={() => void handleToggleActive(employee)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-sidebar disabled:opacity-60"
                      >
                        {togglingId === employee.id
                          ? "Updating…"
                          : employee.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-table-header text-left">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">PIN</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((employee) => (
                      <tr
                        key={employee.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {employee.fullName}
                        </td>
                        <td className="px-4 py-3 text-muted">{employee.phone}</td>
                        <td className="px-4 py-3">
                          {ROLE_LABELS[employee.role]}
                        </td>
                        <td className="px-4 py-3">{renderPinCell(employee)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              employee.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-sidebar text-muted"
                            }`}
                          >
                            {employee.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(employee)}
                              className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-sidebar"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openPinModal(employee)}
                              className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-sidebar"
                            >
                              Reset PIN
                            </button>
                            <button
                              type="button"
                              disabled={togglingId === employee.id}
                              onClick={() => void handleToggleActive(employee)}
                              className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-sidebar disabled:opacity-60"
                            >
                              {togglingId === employee.id
                                ? "…"
                                : employee.isActive
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-medium">Role access</h2>
              <p className="mt-1 text-sm text-muted">
                Choose which modules each role can open. Admin always has full
                access.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {accessSaved && !accessDirty && (
                <span className="text-sm text-emerald-700">Saved</span>
              )}
              <button
                type="button"
                disabled={!accessDirty || savingAccess}
                onClick={() => void handleSaveAccess()}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
              >
                {savingAccess ? "Saving…" : "Save access"}
              </button>
            </div>
          </div>

          {accessError && (
            <p
              className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {accessError}
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-table-header text-left">
                  <th className="sticky left-0 bg-table-header px-4 py-3 font-medium">
                    Module
                  </th>
                  {EMPLOYEE_ROLES.map((role) => (
                    <th
                      key={role}
                      className="px-3 py-3 text-center font-medium"
                    >
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <Fragment key={section.section}>
                    <tr>
                      <td
                        colSpan={EMPLOYEE_ROLES.length + 1}
                        className="bg-sidebar/60 px-4 py-2 text-xs font-medium tracking-wide text-muted uppercase"
                      >
                        {section.label}
                      </td>
                    </tr>
                    {section.items.map((mod) => (
                      <tr
                        key={mod.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="sticky left-0 bg-surface px-4 py-2.5 font-medium">
                          {mod.name}
                        </td>
                        {EMPLOYEE_ROLES.map((role) => {
                          const checked = hasAccess(role, mod.id);
                          const locked = role === "admin";
                          return (
                            <td key={role} className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={locked}
                                onChange={() => toggleAccess(role, mod.id)}
                                aria-label={`${ROLE_LABELS[role]} access to ${mod.name}`}
                                className="h-4 w-4 rounded border-border disabled:opacity-60"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </AppPage>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit employee" : "Add employee"}
        footer={
          <ModalFooterActions
            onCancel={() => setModalOpen(false)}
            onSubmit={() => void handleSaveEmployee()}
            submitLabel={editing ? "Save changes" : "Add employee"}
            busy={saving}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="employee-name" className="mb-1.5 block text-xs text-muted">
              Full name
            </Label>
            <Input
              id="employee-name"
              type="text"
              value={form.fullName}
              onChange={(e) =>
                setForm((f) => ({ ...f, fullName: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="employee-phone" className="mb-1.5 block text-xs text-muted">
              Phone number
            </Label>
            <Input
              id="employee-phone"
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder="10-digit mobile"
            />
          </div>

          <div>
            <Label htmlFor="employee-role" className="mb-1.5 block text-xs text-muted">
              Role
            </Label>
            <NativeSelect
              id="employee-role"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as EmployeeRole,
                }))
              }
              className="w-full sm:w-full"
            >
              {EMPLOYEE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </NativeSelect>
          </div>

          {!editing && (
            <div>
              <Label htmlFor="employee-pin" className="mb-1.5 block text-xs text-muted">
                PIN (6 digits)
              </Label>
              <Input
                id="employee-pin"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={form.pin}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pin: e.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
                className="font-mono"
              />
            </div>
          )}

          {error && (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        title={
          pinTarget
            ? `Reset PIN — ${pinTarget.fullName}`
            : "Reset PIN"
        }
        footer={
          <ModalFooterActions
            onCancel={() => setPinModalOpen(false)}
            onSubmit={() => void handleResetPin()}
            submitLabel="Update PIN"
            busy={saving}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="reset-pin" className="mb-1.5 block text-xs text-muted">
              New PIN (6 digits)
            </Label>
            <Input
              id="reset-pin"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={newPin}
              onChange={(e) =>
                setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="font-mono"
            />
          </div>
          {pinError && (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {pinError}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
