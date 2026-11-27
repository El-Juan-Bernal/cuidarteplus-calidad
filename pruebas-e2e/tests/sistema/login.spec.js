// PRUEBAS DE SISTEMA (caja negra): CUIDARTE+ completo funcionando,
// frontend + backend + base de datos, usado como lo haría una persona.
const { test, expect } = require("@playwright/test");
const { iniciarSesion } = require("../apoyo");

test("La página de inicio de sesión carga correctamente", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Iniciar Sesión/i })).toBeVisible();
});

test("Credenciales incorrectas muestran un mensaje y no dan acceso", async ({ page }) => {
  await iniciarSesion(page, "admin", "clave-equivocada");
  await expect(page.getByText(/Credenciales inválidas/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("Una ruta protegida sin sesión redirige al login", async ({ page }) => {
  await page.goto("/pacientes");
  await expect(page).toHaveURL(/\/login/);
});
