const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const bcrypt = require("bcryptjs");

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorize access" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorize access" });
    }
    req.user = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fdbahux.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("airtalxDB").collection("users");

    app.get("/verifyToken", verifyJWT, (req, res) => {
      const user = req.user;
      // console.log("🚀 ~ app.get ~ user:", user);

      res.send(user);
    });

    //storing user data
    // Email pass login
    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        // Input validation:
        if (!email || !password) {
          res.status(401).json({ error: "Invalid email or password." });
        }

        // Search by email only:
        const user = await usersCollection.findOne({ email });

        // Handle cases where no user is found or password is incorrect:
        if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(401).json({ error: "Invalid email or password." });
        }

        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "7d",
        });

        res.status(200).json({ token, user });
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    // Signup
    app.post("/signup", async (req, res) => {
      const { name, email, role, photoURL, password } = req.body;
      const query = { email: email };

      if (!name || !email || !password) {
        throw new Error("All fields are required");
      }

      const existingUserByEmail = await usersCollection.findOne(query);

      if (existingUserByEmail) {
        return res.status(400).json({
          error:
            "An account with this email already exists. Please use a different email.",
        });
      }

      // Hash password and create new user object
      const hashedPassword = await bcrypt.hash(password, 10);

      const userData = {
        name: name,
        email: email,
        role: role,
        photoURL: photoURL,
        password: hashedPassword,
      };

      const insertedData = await usersCollection.insertOne(userData);
      res
        .status(200)
        .json({ message: "User created successfully", insertedData });
    });
    // Google Login
    app.get("/users/google/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "7d",
        });

        res.send({ token, user });
      } catch (error) {
        console.error("Error finding user:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });
    // Google Signup
    app.post("/google/signup", async (req, res) => {
      const { name, email, role, photoURL } = req.body;
      const query = { email: email };

      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const userData = {
        name: name,
        email: email,
        role: role,
        photoURL: photoURL,
        password: "",
      };

      const insertedData = await usersCollection.insertOne(userData);

      const user = await usersCollection.findOne(query);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });

      res.send({ token, user });
    });

    app.get("/users", async (req, res) => {
      // console.log(req.query.email);
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      // const decodedEmail = req.decoded.email;
      // if(req.query.email !== decodedEmail) {
      //   return res.status(401).send({error: true, message: 'Unauthorize access'});
      // }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/users/admin/:id", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    //making admin role
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //post a job
    const jobPostCollection = client.db("airtalxDB").collection("jobPosts");

    app.get("/newJobPost", async (req, res) => {
      const cursor = jobPostCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/newJobPost", async (req, res) => {
      const newJobPost = req.body;
      // console.log(newJobPost);
      const result = await jobPostCollection.insertOne(newJobPost);
      res.send(result);
    });
    //shows only user's job posts
    app.get("/myJobPosts", async (req, res) => {
      // console.log(req.query.email);
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await jobPostCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/myJobPosts/:id", async (req, res) => {
      const id = req.params.id;
      const querry = { _id: new ObjectId(id) };
      const result = await jobPostCollection.deleteOne(querry);
      res.send(result);
    });

    //applied job
    const appliedJobCollection = client
      .db("airtalxDB")
      .collection("appliedJob");
    app.get("/appliedJob", async (req, res) => {
      try {
        const data = await appliedJobCollection.find().toArray();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.post("/applyJob/:userEmail", async (req, res) => {
      try {
        const userEmail = req.params.userEmail;
        const jobApplicationData = req.body;

        // Check if the job has already been applied by the user
        const existingApplication = await appliedJobCollection.findOne({
          userEmail: userEmail,
          jobId: jobApplicationData.jobId,
        });

        if (existingApplication) {
          // If the job has already been applied by the user, send a response indicating so
          res.status(400).json({ error: "Job already applied by this user." });
        } else {
          // If the job has not been applied by the user, insert the job application data into the collection
          await appliedJobCollection.insertOne({
            userEmail: userEmail,
            jobId: jobApplicationData.jobId,
            status: "pending", // assuming the status is initially pending
            employeEmail: "", // employee email will be assigned later
            jobData: jobApplicationData.jobData,
          });

          // Send a success response
          res
            .status(200)
            .json({ message: "Job application submitted successfully." });
        }
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.post("/appliedJob/employe/:employeEmail", async (req, res) => {
      try {
        // Extract employeEmail and status from the URL parameters
        const employeEmail = req.params.employeEmail;

        // Construct filter based on employeEmail and status
        const filter = { employeEmail, status: "approved" };

        // Query the collection with the filter
        const data = await appliedJobCollection.find(filter).toArray();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.post("/appliedJob/jobseeker/:userEmail", async (req, res) => {
      try {
        // Extract employeEmail and status from the URL parameters
        const userEmail = req.params.userEmail;

        // Construct filter based on employeEmail and status
        const filter = { userEmail };

        // Query the collection with the filter
        const data = await appliedJobCollection.find(filter).toArray();
        res.json(data);
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("project is running");
});

app.listen(port, () => {
  console.log(`project is running on port ${port}`);
});
