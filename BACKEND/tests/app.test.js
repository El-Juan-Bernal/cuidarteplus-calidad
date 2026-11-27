const request = require("supertest");
const app = require("../src/app");

describe("Pruebas de integración - API CuidartePlus", () => {
  test("GET / debe responder 200 y estado ok", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ name: "cuidarteplus", status: "ok" });
  });

  test("GET / no debe exponer la cabecera x-powered-by", async () => {
    const res = await request(app).get("/");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  test("GET /openapi.json debe devolver la especificación OpenAPI", async () => {
    const res = await request(app).get("/openapi.json");
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });

  test("GET /ruta-inexistente debe responder 404", async () => {
    const res = await request(app).get("/ruta-inexistente");
    expect(res.statusCode).toBe(404);
  });
});

