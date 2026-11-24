const request = require('supertest');
const mongoose = require('mongoose');
const { expect } = require('chai');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Auth API', () => {
  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/meteriq_test');
  });

  after(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('should allow a user to sign up as an analyst', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@meteriq.energy',
        password: 'password123',
        fullName: 'Test User',
        role: 'analyst'
      });
    expect(res.status).to.equal(201);
    expect(res.body.user.role).to.equal('analyst');
  });

  it('should block public signup as supervisor', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'admin@meteriq.energy',
        password: 'password123',
        fullName: 'Admin User',
        role: 'supervisor'
      });
    expect(res.status).to.equal(403);
  });

  it('should allow login with correct credentials', async () => {
    await User.create({
      email: 'user@meteriq.energy',
      password: 'password123', // User model hashes this
      fullName: 'User',
      role: 'analyst'
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@meteriq.energy', password: 'password123' });
    
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('token');
  });

  it('should block access to protected routes without token', async () => {
    const res = await request(app).get('/api/meters');
    expect(res.status).to.equal(401);
  });
});
