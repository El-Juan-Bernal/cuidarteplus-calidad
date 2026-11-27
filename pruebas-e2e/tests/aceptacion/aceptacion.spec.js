// PRUEBAS DE ACEPTACIÓN: flujos completos de usuario y control de acceso por rol
const { test, expect } = require("@playwright/test");
const { iniciarSesion, cerrarSesion } = require("../apoyo");

test("Administrador inicia sesión, gestiona pacientes, accede a usuarios y cierra sesión", async ({ page }) => {
  await iniciarSesion(page, "admin", "admin");
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

  // Acceso a listado de pacientes con registros cargados desde PostgreSQL
  await page.goto("/pacientes");
  await expect(page.locator("table")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("11111111-9")).toBeVisible();

  // Acceso a ruta exclusiva de administrador
  await page.goto("/usuarios");
  await expect(page).toHaveURL(/\/usuarios/);
  await expect(page.locator("table")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/No autorizado/i)).toHaveCount(0);

  // Cierre de sesión y bloqueo posterior de rutas protegidas
  await cerrarSesion(page);
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/pacientes");
  await expect(page).toHaveURL(/\/login/);
});

test("Médico consulta pacientes y tiene bloqueadas las rutas de administrador", async ({ page }) => {
  await iniciarSesion(page, "medico", "medico");
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

  // Puede consultar el listado de pacientes
  await page.goto("/pacientes");
  await expect(page.locator("table")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("11111111-9")).toBeVisible();

  // Bloqueo en rutas protegidas por RequireAdmin
  await page.goto("/usuarios");
  await expect(page.getByText(/No autorizado \(solo administrador\)/i)).toBeVisible();

  await page.goto("/auditoria");
  await expect(page.getByText(/No autorizado \(solo administrador\)/i)).toBeVisible();

  await cerrarSesion(page);
  await expect(page).toHaveURL(/\/login/);
});

test("Paciente tiene bloqueadas las rutas administrativas y puede cerrar sesión", async ({ page }) => {
  await iniciarSesion(page, "paciente", "paciente");
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });

  await page.goto("/usuarios");
  await expect(page.getByText(/No autorizado \(solo administrador\)/i)).toBeVisible();

  await page.goto("/auditoria");
  await expect(page.getByText(/No autorizado \(solo administrador\)/i)).toBeVisible();

  await cerrarSesion(page);
  await expect(page).toHaveURL(/\/login/);
});
