
require("dotenv").config();

const mongoose = require("mongoose");
const testMongoUri = process.env.MONGODB_TEST_URI;
const productionMongoUri = process.env.MONGODB_URI;

function databaseIdentity(uri) {
  const parsed = new URL(uri);
  return `${parsed.host}${parsed.pathname}`;
}

if (!testMongoUri) {
  throw new Error("MONGODB_TEST_URI is required. Tests cannot run.");
}

if (
  productionMongoUri &&
  databaseIdentity(testMongoUri) === databaseIdentity(productionMongoUri)
) {
  throw new Error("Unsafe test configuration: production database detected.");
}

const request = require("supertest");
const { expect } = require("chai");
const app = require("../src/app");
const User = require("../src/models/User");

describe("MeterIQ Authentication and User Management API", function () {
  let admin;
  let analyst;
  let supervisor;

  let adminToken;
  let analystToken;
  let supervisorToken;

  async function login(email, password = "password123") {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email, password });

    expect(response.status).to.equal(200);
    return response.body.token;
  }

  before(async function () {
    await mongoose.connect(testMongoUri);
    console.log("Connected to isolated test database.");
  });

  after(async function () {
    await mongoose.connection.close();
  });

  beforeEach(async function () {
    await User.deleteMany({});

    admin = await User.create({
      fullName: "Test Controller",
      email: "controller@meteriq.test",
      password: "password123",
      role: "admin",
      isActive: true
    });

    analyst = await User.create({
      fullName: "Test Analyst",
      email: "analyst@meteriq.test",
      password: "password123",
      role: "analyst",
      isActive: true
    });

    supervisor = await User.create({
      fullName: "Test Supervisor",
      email: "supervisor@meteriq.test",
      password: "password123",
      role: "supervisor",
      isActive: true
    });

    adminToken = await login("controller@meteriq.test");
    analystToken = await login("analyst@meteriq.test");
    supervisorToken = await login("supervisor@meteriq.test");
  });

  it("should block public signup", async function () {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({
        fullName: "New User",
        email: "new@meteriq.test",
        password: "password123",
        role: "analyst"
      });

    expect(response.status).to.equal(403);
  });

  it("should allow Controller to view all users", async function () {
    const response = await request(app)
      .get("/api/auth/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).to.equal(200);
    expect(response.body.users).to.be.an("array");
    expect(response.body.users.length).to.equal(3);
    expect(response.body.users[0]).to.not.have.property("password");
  });

  it("should allow Controller to create an Analyst", async function () {
    const response = await request(app)
      .post("/api/auth/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: "New Analyst",
        email: "newanalyst@meteriq.test",
        password: "password123",
        role: "analyst"
      });

    expect(response.status).to.equal(201);
    expect(response.body.user.role).to.equal("analyst");
    expect(response.body.user.isActive).to.equal(true);
  });

  it("should allow Controller to create a Supervisor", async function () {
    const response = await request(app)
      .post("/api/auth/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: "New Supervisor",
        email: "newsupervisor@meteriq.test",
        password: "password123",
        role: "supervisor"
      });

    expect(response.status).to.equal(201);
    expect(response.body.user.role).to.equal("supervisor");
  });

  it("should prevent Controller from creating another admin", async function () {
    const response = await request(app)
      .post("/api/auth/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fullName: "Unauthorized Controller",
        email: "newadmin@meteriq.test",
        password: "password123",
        role: "admin"
      });

    expect(response.status).to.equal(400);
  });

  it("should allow Controller to change an Analyst into a Supervisor", async function () {
    const response = await request(app)
      .patch(`/api/auth/users/${analyst._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "supervisor" });

    expect(response.status).to.equal(200);
    expect(response.body.user.role).to.equal("supervisor");

    const updatedUser = await User.findById(analyst._id);
    expect(updatedUser.role).to.equal("supervisor");
  });

  it("should allow Controller to deactivate a user", async function () {
    const response = await request(app)
      .patch(`/api/auth/users/${analyst._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(response.status).to.equal(200);
    expect(response.body.user.isActive).to.equal(false);
  });

  it("should prevent a deactivated user from using protected routes", async function () {
    await User.findByIdAndUpdate(analyst._id, { isActive: false });

    const response = await request(app)
      .get("/api/auth/users")
      .set("Authorization", `Bearer ${analystToken}`);

    expect(response.status).to.equal(403);
  });

  it("should prevent an Analyst from accessing user management", async function () {
    const response = await request(app)
      .get("/api/auth/users")
      .set("Authorization", `Bearer ${analystToken}`);

    expect(response.status).to.equal(403);
  });

  it("should prevent a Supervisor from creating users", async function () {
    const response = await request(app)
      .post("/api/auth/users")
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({
        fullName: "Unauthorized User",
        email: "unauthorized@meteriq.test",
        password: "password123",
        role: "analyst"
      });

    expect(response.status).to.equal(403);
  });

  it("should prevent a normal user from promoting themselves to admin", async function () {
    const response = await request(app)
      .patch(`/api/auth/users/${analyst._id}`)
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ role: "admin" });

    expect(response.status).to.equal(403);
  });

  it("should prevent modification of Controller accounts", async function () {
    const response = await request(app)
      .patch(`/api/auth/users/${admin._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "analyst" });

    expect(response.status).to.equal(403);
  });
});
