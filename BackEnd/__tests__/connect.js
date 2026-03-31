const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/expenses_test');
});

test('signup creates a new user', async () => {
    const res = await request(app)
        .post('/api/signUp')
        .send({ userName: 'testuser', password: 'Test@1234' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User Created Successfully!');
});

test('Duplicate user',async()=>{
   const res = await request(app).post('/api/signUp').send({userName:'testuser',password:"Test@1234"});
   expect(res.status).toBe(400);
   expect(res.body.message).toBe('User Already Exists')
})


test("Sign In",async()=>{
  const res = await request(app).post('/api/signIn').send({userName:'testuser',password:'Test@1234'});
  expect(res.status).toBe(200);
  expect(res.body.token).toBeDefined();
})

test('Wrong User',async()=>{
    const res = await request(app).post('/api/signIn').send({userName:'testuser',password:'Test@1'})
    expect(res.status).toBe(401)
    expect(res.body.message).toBe(`Invalid Credentials`)
})

test('token not present',async()=>{
    const res = await request(app).get('/api/get-all-expenses');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No auth token is present');
})

test('Adding expense',async ()=>{
    const login = await request(app).post('/api/signIn').send({userName:'testuser',password:'Test@1234'});
    const token = login.body.token;
    const res = await request(app).post('/api/add-expense').set({'authorization':'Bearer'+' '+token}).send({amount: 200, category: "Education", description: "", date: "2026-03-24"});
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Expenses Added!!')
})

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
});