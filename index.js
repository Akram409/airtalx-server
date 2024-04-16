const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if(!authorization) {
    return res.status(401).send({error: true, message: 'Unauthorize access'});
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err) {
      return res.status(401).send({error: true, message: 'Unauthorize access'});
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fdbahux.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db('airtalxDB').collection('users');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
      res.send({token});
    })

    //storing user data
    app.get('/users', async (req, res) => {
      console.log(req.query.email);
      let query = {};
      if(req.query?.email) {
        query = {email: req.query.email}
      }
      // const decodedEmail = req.decoded.email;
      // if(req.query.email !== decodedEmail) {
      //   return res.status(401).send({error: true, message: 'Unauthorize access'});
      // }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const userData = req.body;
      const query = {email: userData.email}
      const existingUser = await usersCollection.findOne(query);
      if(existingUser) {
        return res.send({message: 'user already exists'})
      }
      const insertedData = await usersCollection.insertOne(userData);
      res.send(insertedData);
    });

    app.get('/users/admin/:id', verifyJWT, async(req, res) => {
      const email = req.params.email;
      if(req.decoded.email !== email) {
        res.send({admin: false})
      }
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = {admin: user?.role === 'admin'};
      res.send(result);
    })

    //making admin role
    app.patch('/users/admin/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    //post a job
    const jobPostCollection = client.db('airtalxDB').collection('jobPosts');

    app.get('/newJobPost', async (req, res) => {
      const cursor = jobPostCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.post('/newJobPost', async (req, res) => {
      const newJobPost = req.body;
      console.log(newJobPost);
      const result = await jobPostCollection.insertOne(newJobPost);
      res.send(result);
    })

    //shows only user's job posts
    app.get('/myJobPosts', async (req, res) => {
      console.log(req.query.email);
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await jobPostCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/myJobPosts/:id', async (req, res) => {
      const id = req.params.id;
      const querry = { _id: new ObjectId(id) };
      const result = await jobPostCollection.deleteOne(querry);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('project is running');
})

app.listen(port, () => {
  console.log(`project is running on port ${port}`);
})