const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const UPLOAD_FOLDER = "./public/image";
var nodemailer = require("nodemailer");
app.use(express.static("public"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_FOLDER);
  },
  filename: (req, file, cb) => {
    if (file) {
      const fileExt = path.extname(file.originalname);
      const fileName =
        file.originalname
          .replace(fileExt, "")
          .toLowerCase()
          .split(" ")
          .join("-") +
        "-" +
        Date.now();
      cb(null, fileName + fileExt);
    }
  },
});

var upload = multer({
  storage: storage,
});

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
    //applied job
    const appliedJobCollection = client
      .db("airtalxDB")
      .collection("appliedJob");
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

        // Check if the user is verified:
        if (!user.verification) {
          return res.status(401).json({ error: "User not verified." });
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
    app.post("/signup", upload.single("images"), async (req, res) => {
      const { name, email, role, password, memberSince } = req.body;
      const filenames = req.file.filename;
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

      const otp = Math.floor(100000 + Math.random() * 900000);

      // Hash password and create new user object
      const hashedPassword = await bcrypt.hash(password, 10);
      const path = "http://localhost:5000/image/";
      const userData = {
        name: name,
        email: email,
        role: role,
        photoURL: path + filenames,
        password: hashedPassword,
        verification: false,
        otp,
        about: "",
        studies: "",
        location: "",
        country: "",
        resume: "",
        preferredSalary: "",
        preferredJobType: "",
        expertiseField: "",
        expertiseLevel: "",
        jobPosition: "",
        jobCompanySize: "",
        jobCompanyName: "",
        aboutCompany: "",
        industry: "",
        memberSince,
      };

      var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "algobot701@gmail.com",
          pass: "jfth qddl nkgp yitb",
        },
      });

      var mailOptions = {
        from: '"Fred Foo 👻"',
        to: email,
        subject: "Email Verification",
        text: "Confirmation email",
        html: `
            <b>Hello ${name}. Please confirm your otp.</b>
            <b>Your confirmation code is</b>
            <h1>${otp}</h1>
        `,
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          return res.send({ Status: "Success" });
        }
      });

      const insertedData = await usersCollection.insertOne(userData);
      res
        .status(200)
        .json({ message: "User created successfully", insertedData });
    });
    // !------------OTP Verification----------
    app.post("/otp-verification", async (req, res) => {
      try {
        const { otp } = req.body;
        const user = await usersCollection.findOne({ otp });
        if (!user) {
          return res.status(401).json({ message: 'otp didn"t match' });
        }
        const result = await usersCollection.updateOne(
          { _id: user._id },
          { $set: { verification: true } }
        );
        return res.status(200).json({
          message: "successfully verify email. have a good day",
          success: true,
        });
      } catch (error) {
        console.log(error);
      }
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

        // Check if the user is verified:
        if (!user.verification) {
          return res.status(401).json({ error: "User not verified." });
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
      const { name, email, role, photoURL, memberSince } = req.body;
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
        verification: true,
        about: "",
        studies: "",
        location: "",
        country: "",
        resume: "",
        preferredSalary: "",
        preferredJobType: "",
        expertiseField: "",
        expertiseLevel: "",
        jobPosition: "",
        jobCompanySize: "",
        jobCompanyName: "",
        aboutCompany: "",
        industry: "",
        memberSince,
      };

      const insertedData = await usersCollection.insertOne(userData);

      const user = await usersCollection.findOne(query);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });

      res.send({ token, user });
    });
    // Update Profile
    app.put("/update/:email", upload.single("images"), async (req, res) => {
      try {
        const email = req.params.email;
        const {
          name,
          password,
          about,
          role,
          studies,
          location,
          country,
          oldPass,
          preferredSalary,
          preferredJobType,
          expertiseField,
          expertiseLevel,
          jobPosition,
          jobCompanySize,
          aboutCompany,
          industry,
          jobCompanyName,
          isUpdate,
        } = req.body;
        console.log("🚀 ~ app.put ~ oldPass:", oldPass);
        const filename = req.file ? req.file.filename : undefined;
        const newPassword = password ? password : undefined;

        // Retrieve existing user data
        const existingUser = await usersCollection.findOne({ email });
        if (!existingUser) {
          return res.status(404).json({ error: "User not found." });
        }

        // Update fields provided in the request body
        const paths = "http://localhost:5000/image/";
        const userToUpdate = {
          name,
          about,
          studies,
          location,
          country,
          preferredSalary,
          preferredJobType,
          expertiseField,
          expertiseLevel,
          jobPosition,
          jobCompanyName,
          jobCompanySize,
          aboutCompany,
          industry,
        };

        if (isUpdate == "False") {
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          userToUpdate.password = hashedPassword;
        } else if (isUpdate == "True") {
          userToUpdate.password = oldPass;
        }
        if (filename) userToUpdate.photoURL = paths + filename;

        console.log("testing", userToUpdate);
        // Update user data in the database
        const result = await usersCollection.updateOne(
          { email },
          { $set: userToUpdate }
        );

        // Check if the role is "employer"
        if (role === "employer") {
          // Retrieve all documents from appliedJob collection where employeEmail matches the user's email
          const appliedJobsToUpdate = await appliedJobCollection
            .find({ employeEmail: email })
            .toArray();

          // Update companyName in each document
          const updatedJobs = appliedJobsToUpdate.map(async (job) => {
            await appliedJobCollection.updateOne(
              { _id: job._id },
              { $set: { "jobData.companyName": name } }
            );
          });

          // Retrieve all documents from jobPostCollection where email matches the user's email
          const jobPostsToUpdate = await jobPostCollection
            .find({ email })
            .toArray();

          // Update companyName in each document in jobPostCollection
          const updatedJobPosts = jobPostsToUpdate.map(async (jobPost) => {
            await jobPostCollection.updateOne(
              { _id: jobPost._id },
              { $set: { companyName: name } }
            );
          });

          // Wait for all updates to complete
          await Promise.all(updatedJobs, updatedJobPosts);
        }

        const user = await usersCollection.findOne({ email });

        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "7d",
        });

        res.json({ token, user });
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.get("/users", async (req, res) => {
      // console.log(req.query.email);
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/users/jobseeker", async (req, res) => {
      let query = { role: "jobseeker" };
      try {
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching jobseeker data:", error);
        res.status(500).send("Internal Server Error");
      }
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
    app.delete("/user/delete/:email", async (req, res) => {
      try {
        const userEmail = req.params.email;
        if (!userEmail) {
          return res.status(400).json({ error: "Email parameter is missing." });
        }

        // Find the user by email to get their role
        const user = await usersCollection.findOne({ email: userEmail });
        if (!user) {
          return res.status(404).json({ error: "User not found." });
        }

        // Delete the user from the users collection
        const query = { email: userEmail };
        const result = await usersCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "User not found." });
        }

        // Based on the user's role, perform additional actions
        if (user.role === "jobseeker") {
          // If the user is a jobseeker, delete all applied job data associated with them
          await appliedJobCollection.deleteMany({ userEmail: userEmail });
        } else if (user.role === "employer") {
          // If the user is an employer, delete their job posts and related applied job data
          await jobPostCollection.deleteMany({ email: userEmail });
          await appliedJobCollection.deleteMany({ employeEmail: userEmail });
        }

        res.status(200).json({ message: "User deleted successfully." });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
    // Password Reset
    app.post("/forgot-password/:email", async (req, res) => {
      const userEmail = req.params.email;
      console.log("🚀 ~ app.post ~ email:", userEmail);

      try {
        const user = await usersCollection.findOne({ email: userEmail });
        if (!user) {
          return res.send({ Status: "User not existed" });
        }

        const token = jwt.sign(
          { id: user._id },
          process.env.ACCESS_TOKEN_SECRET,
          {
            expiresIn: "7d",
          }
        );

        var transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: "algobot701@gmail.com",
            pass: "jfth qddl nkgp yitb",
          },
        });

        var mailOptions = {
          from: "algobot701@gmail.com",
          to: user.email,
          subject: "Reset Password Link",
          text: `http://localhost:5173/reset_password/${user._id}/${token}`,
        };

        transporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            console.log(error);
          } else {
            return res.send({ Status: "Success" });
          }
        });
      } catch (error) {
        console.error("Error occurred:", error);
        return res.status(500).send({ Status: "Error" });
      }
    });
    app.post("/reset-password/:id/:token", async (req, res) => {
      const { id, token } = req.params;
      const { password } = req.body;

      try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        if (!decoded) {
          return res.json({ Status: "Error with token" });
        }

        // Hash the new password
        const hash = await bcrypt.hash(password, 10);

        // Update the user's password
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { password: hash } }
        );

        if (result.modifiedCount === 1) {
          // Password updated successfully
          return res.send({ Status: "Success" });
        } else {
          // No document was modified (no user found with the provided ID)
          return res.status(404).json({ Status: "User not found." });
        }
      } catch (error) {
        console.error("Error occurred:", error);
        return res.status(500).send({ Status: "Error" });
      }
    });

    app.get("/filterJobseeker", async (req, res) => {
      try {
        const { searchValue, typeSelect } = req.query;

        // Construct the filter object based on typeSelect and searchValue

        const filter = { role: "jobseeker" };
        if (!typeSelect) {
          // If no type is selected, search both jobTitle and companyName
          filter.$or = [
            { name: { $regex: new RegExp(searchValue, "i") } },
            { email: { $regex: new RegExp(searchValue, "i") } },
          ];
        } else if (typeSelect === "Name") {
          filter.name = { $regex: new RegExp(searchValue, "i") };
        } else if (typeSelect === "Email") {
          filter.email = { $regex: new RegExp(searchValue, "i") };
        } else {
          // If type is invalid, return empty result
          return res.json([]);
        }

        // Fetch job posts based on the constructed filter
        const filterJobseekers = await usersCollection.find(filter).toArray();

        res.json(filterJobseekers);
      } catch (error) {
        console.error("Error filtering job posts:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    // Resuem Upload
    app.post(
      "/resume/upload/:userEmail",
      upload.single("file"),
      async (req, res) => {
        try {
          const email = req.params.userEmail;
          const file = req.file;

          if (!file) {
            return res.status(400).json({ error: "No file uploaded." });
          }

          // Update the user's resume field with the filename
          const result = await usersCollection.updateOne(
            { email: email },
            { $set: { resume: file.filename } }
          );

          if (result.modifiedCount === 1) {
            const user = await usersCollection.findOne({ email });

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
              expiresIn: "7d",
            });

            res.json({ token, user });
          } else {
            res.status(404).json({ error: "User not found." });
          }
        } catch (error) {
          console.error("Error uploading resume:", error);
          res.status(500).json({ error: "Internal server error." });
        }
      }
    );
    // Resume Download
    app.get("/download/resume/:resumePath", (req, res) => {
      const name = req.params.resumePath;
      res.download(path.resolve(`public\\image\\${name}`));
    });

    //post a blog
    const blogPostCollection = client.db("airtalxDB").collection("newBlogs");

    app.post("/newBlogs", async (req, res) => {
      const newBlogs = req.body;
      // console.log(newBlogs);
      const result = await blogPostCollection.insertOne(newBlogs);
      res.send(result);
    });
    app.get("/newBlogs", async (req, res) => {
      const result = await blogPostCollection.find().toArray();
      res.send(result);
    });
    app.get("/newBlogs/:id", async (req, res) => {
      const blogId = req.params.id;

      try {
        const result = await blogPostCollection.findOne({
          _id: new ObjectId(blogId),
        });
        if (result) {
          res.send(result);
        } else {
          res.status(404).send("Blog post not found.");
        }
      } catch (error) {
        console.error("Error finding blog post:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/blog/update/likeDislike/:id", async (req, res) => {
      const { id } = req.params;
      const { userEmail, reaction } = req.body;

      try {
        let update;
        let message;

        const blog = await blogPostCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!blog) {
          res.status(404).send("Blog post not found.");
          return;
        }

        if (reaction === "like") {
          if (blog.reactLike.includes(userEmail)) {
            update = {
              $pull: { reactLike: userEmail },
              $inc: { likes: -1 },
            };
            message = "Like removed from the blog";
          } else {
            update = {
              $addToSet: { reactLike: userEmail },
              $inc: { likes: 1 },
            };
            message = "Like added for the blog";
            if (blog.reactDisLike.includes(userEmail)) {
              update.$pull = { reactDisLike: userEmail };
              update.$inc.dislikes = -1;
              message = "Like removed from the blog";
            }
          }
        } else if (reaction === "dislike") {
          if (blog.reactDisLike.includes(userEmail)) {
            update = {
              $pull: { reactDisLike: userEmail },
              $inc: { dislikes: -1 },
            };
            message = "Dislike removed from the blog";
          } else {
            update = {
              $addToSet: { reactDisLike: userEmail },
              $inc: { dislikes: 1 },
            };
            message = "Dislike added for the blog";

            if (blog.reactLike.includes(userEmail)) {
              update.$pull = { reactLike: userEmail };
              update.$inc.likes = -1;
              message = "Dislike removed from the blog";
            }
          }
        } else {
          res.status(400).send("Invalid reaction");
          return;
        }

        const result = await blogPostCollection.updateOne(
          { _id: new ObjectId(id) },
          update
        );

        if (result.modifiedCount === 1) {
          res.send(message);
        } else {
          res.status(500).send("Failed to update reaction");
        }
      } catch (error) {
        console.error("Error updating reaction:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //post a job
    const jobPostCollection = client.db("airtalxDB").collection("jobPosts");
    app.get("/filterJob", async (req, res) => {
      try {
        const { searchValue, typeSelect } = req.query;

        // Construct the filter object based on typeSelect and searchValue
        const filter = {};

        if (!typeSelect) {
          // If no type is selected, search both jobTitle and companyName
          filter.$or = [
            { jobTitle: { $regex: new RegExp(searchValue, "i") } },
            { companyName: { $regex: new RegExp(searchValue, "i") } },
          ];
        } else if (typeSelect === "Job") {
          filter.jobTitle = { $regex: new RegExp(searchValue, "i") };
        } else if (typeSelect === "Employer") {
          filter.companyName = { $regex: new RegExp(searchValue, "i") };
        } else if (typeSelect === "Full Time") {
          filter.jobType = "Full Time";
        } else if (typeSelect === "Part Time") {
          filter.jobType = "Part Time";
        } else {
          // If type is invalid, return empty result
          return res.json([]);
        }

        // Fetch job posts based on the constructed filter
        const filteredJobs = await jobPostCollection.find(filter).toArray();

        res.json(filteredJobs);
      } catch (error) {
        console.error("Error filtering job posts:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });
    app.get("/newJobPost", async (req, res) => {
      const result = await jobPostCollection.find().toArray();
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
    app.get("/jobPost/employe/:employeEmail", async (req, res) => {
      try {
        const employeEmail = req.params.employeEmail;

        // Construct filter based on employeEmail
        const filter = { email: employeEmail };

        // Query the collection with the filter
        const result = await jobPostCollection.find(filter).toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching job posts:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.delete("/myJobPosts/:id", async (req, res) => {
      const id = req.params.id;
      const querry = { _id: new ObjectId(id) };
      const result = await jobPostCollection.deleteOne(querry);
      res.send(result);
    });
    app.get("/jobPost/:id", async (req, res) => {
      try {
        const jobId = req.params.id;

        // Construct filter based on jobId
        const filter = { _id: new ObjectId(jobId) };

        // Query the collection with the filter
        const jobData = await jobPostCollection.findOne(filter);

        if (!jobData) {
          return res.status(404).json({ error: "Job not found." });
        }

        res.json(jobData);
      } catch (error) {
        console.error("Error fetching job post:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });

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
          res.status(400).json({ error: "Job already applied!" });
        } else {
          // If the job has not been applied by the user, insert the job application data into the collection
          await appliedJobCollection.insertOne({
            userEmail: userEmail,
            jobId: jobApplicationData.jobId,
            status: "pending",
            projectStatus: "Not Complete",
            employeEmail: jobApplicationData.employeEmail,
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
    app.get("/job/employe/:employeEmail", async (req, res) => {
      try {
        const employeEmail = req.params.employeEmail;

        // Construct filter based on employeEmail and status
        const filter = {
          employeEmail,
          status: "approved",
          projectStatus: "Not Complete",
        };

        // Query the collection with the filter
        const data = await appliedJobCollection.find(filter).toArray();
        res.json(data);
      } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.get("/job/employe/pending/:employeEmail", async (req, res) => {
      try {
        const employeEmail = req.params.employeEmail;
        console.log("🚀 ~ app.get ~ employeEmail:", employeEmail);

        // Construct filter based on employeEmail and status
        const filter = { employeEmail, status: "pending" };

        // Query the collection with the filter
        const data = await appliedJobCollection.find(filter).toArray();

        res.json(data);
      } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.get("/job/employe/history/:employeEmail", async (req, res) => {
      try {
        const employeEmail = req.params.employeEmail;

        // Construct filter based on employeEmail, status, and projectStatus
        const filter = {
          employeEmail,
          status: "approved",
          projectStatus: { $ne: "Not Complete" },
        };

        // Query the collection with the filter
        const data = await appliedJobCollection.find(filter).toArray();

        res.json(data);
      } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.get("/job/jobseeker/history/:jobseekerEmail", async (req, res) => {
      try {
        const userEmail = req.params.jobseekerEmail;

        // Construct filter based on employeEmail, status, and projectStatus
        const filter = {
          userEmail,
          status: "approved",
          projectStatus: { $ne: "Not Complete" },
        };

        // Query the collection with the filter
        const data = await appliedJobCollection.find(filter).toArray();

        res.json(data);
      } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.post("/appliedJob/jobseeker/:userEmail", async (req, res) => {
      try {
        // Extract userEmail from the URL parameters
        const userEmail = req.params.userEmail;

        const filter = {
          userEmail,
          status: "approved",
          projectStatus: "Not Complete",
        };

        // Query the collection with the filter
        const data = await appliedJobCollection.find(filter).toArray();

        res.json(data);
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.post("/appliedJob/jobseeker/all/:userEmail", async (req, res) => {
      try {
        // Extract userEmail from the URL parameters
        const userEmail = req.params.userEmail;

        const filter = { userEmail };

        // Query the collection with the filter
        const data = await appliedJobCollection.find(filter).toArray();

        res.json(data);
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.patch("/appliedJob/updateStatus/:userEmail", async (req, res) => {
      try {
        const userEmail = req.params.userEmail;
        const { jobId, status } = req.body;

        // Update the status of the job application for the specified user and job ID
        const result = await appliedJobCollection.updateOne(
          { userEmail: userEmail, jobId: jobId },
          { $set: { status: status } }
        );

        if (result.modifiedCount === 1) {
          // If the job application status was successfully updated
          res.json({ message: "Job application Approved" });
        } else {
          // If no documents were modified (no matching job application found)
          res.status(404).json({ error: "Job application not found." });
        }
      } catch (error) {
        console.error("Error updating job application status:", error);
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.patch(
      "/appliedJob/updateProjectStatus/:userEmail",
      async (req, res) => {
        try {
          const userEmail = req.params.userEmail;
          const { jobId, projectStatus } = req.body;

          // Update the status of the job application for the specified user and job ID
          const result = await appliedJobCollection.updateOne(
            { userEmail: userEmail, jobId: jobId },
            { $set: { projectStatus: projectStatus } }
          );

          if (result.modifiedCount === 1) {
            // If the job application status was successfully updated
            res.json({ message: "Job application Approved" });
          } else {
            // If no documents were modified (no matching job application found)
            res.status(404).json({ error: "Job application not found." });
          }
        } catch (error) {
          console.error("Error updating job application status:", error);
          res.status(500).json({ error: "Internal server error." });
        }
      }
    );

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
