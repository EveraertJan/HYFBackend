const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const cors = require("cors");
const uuidV1 = require("uuid");
const jwt = require("jwt-simple");
const md5 = require("md5");
const app = express();
const server = http.Server(app);
const retryKnex = require('./retryKnex');

const PORT = 3000;

const secret = "quothed the raven";

class App {
  constructor(opts) {
    this.pg = require("knex")({
      client: "pg",
      version: '9.6',
      connection: process.env.PG_CONNECTION_STRING,
      searchPath: ['knex', 'public'],
      pool: {
        min: 2,
        max: 6,
        createTimeoutMillis: 3000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false // <- default is true, set to false
      }

    });

    const _this = this;

    this.pg.raw("select 1+1 as result").then(function() {
      _this.initialiseTables();
    });

    this.start = this.start.bind(this);

    this.app = express();
    this.s = http.Server(this.app);

  }

  authorise(req, res, next) {
    if (req.headers.authorization) {
      const token = req.headers.authorization
        .replace(" ", "")
        .replace("Bearer:", "")
        .replace("bearer:", "");
      try {
        const decoded = jwt.decode(token, secret);
        req.body["authUserId"] = decoded.uuid;
        next();
      } catch (e) {
        res.status(401).send({ error: "incorrect token" });
      }
    } else {
      res.status(401).send({ error: "no token found" });
    }
  }
  async start() {
    app.use(bodyParser.json()); // to support JSON-encoded bodies

    app.use(cors({ credentials: false, origin: "*" }));

    app.get("/", async (req, res, next) => {
      res.send(html);
      await this.pg
        .select('*')
        .table("users").then((d) => {
          console.log(d)
        })
    });

    app.post("/login", async (req, res, next) => {
      await this.pg
        .select("*")
        .table("users")
        .where({
          email: req.body.email
        })
        .then(data => {
          for (let i = 0; i < data.length; i++) {
            if (md5(req.body.password) == data[i].password) {
              const { email, uuid, firstName, lastName } = data[i];
              const token = jwt.encode(
                { email, firstName, lastName, uuid },
                secret
              );
              res.status(200).send(token);
            }
          }
          res.status(401).send();
        });
    });

    app.post("/register", async (req, res, next) => {
      const insert = {
        email: req.body.email,
        password: md5(req.body.password),
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dateofbirth: req.body.dateofbirth
      };
      insert["uuid"] = uuidV1();

      await this.pg
        .select("uuid")
        .table("users")
        .where({ email: insert.email })
        .then(async data => {
          if (data.length == 0) {
            console.log(data, insert)
            await this.pg
              .insert(insert)
              .table("users")
              .returning("*")
              .then(r => {
                console.log("returning", r)
                res.status(200).send(r);
              })
              .catch(e => res.status(401).send(e));
          } else {
            res.status(400).send({ error: "email already exists" });
          }
        }).catch(e => res.status(401).send(e));
    });
    app.get("/posts", this.authorise, async (req, res, next) => {
      await this.pg
        .select("*")
        .table("posts")
        .where({
          userID: req.body.authUserId
        })
        .then(data => {
          res.send(data);
        })
        .catch(error => {
          console.log(error);
          res.status(401).send();
        });
    });
    app.get("/cleanup", this.authorise, async (req, res, next) => {
      await this.pg
        .del()
        .where({ content: null, title: null })
        .table("posts")
        .then(data => {
          res.send(data);
        })
        .catch(e => {
          res.status(401).send;
        });
    });
    app.get("/posts/:id", this.authorise, async (req, res, next) => {
      await this.pg
        .select("*")
        .where({ id: req.params.id, userID: req.body.authUserId })
        .table("posts")
        .then(data => {
          res.send(data);
        })
        .catch(error => {
          console.log(error);
          res.status(401).send();
        });
    });
    app.delete("/posts/:id", this.authorise, async (req, res, next) => {
      await this.pg
        .del()
        .where({ id: req.params.id, userID: req.body.authUserId })
        .table("posts")
        .then(() => {
          res.status(200).send("OK");
        })
        .catch(error => {
          console.log(error);
          res.status(401).send();
        });
    });

    app.patch("/posts/:id", this.authorise, async (req, res, next) => {
      const data = {
        title: req.body.title,
        content: req.body.content
      };

      await this.pg
        .update(data)
        .where({ id: req.params.id, userID: req.body.authUserId })
        .table("posts")
        .returning("*")
        .then(data => {
          res.send(data);
        })
        .catch(error => {
          console.log(error);
          res.status(401).send();
        });
    });
    app.post("/posts", this.authorise, async (req, res, next) => {
      const data = {
        title: req.body.title,
        content: req.body.content,
        userID: req.body.authUserId
      };
      data["uuid"] = uuidV1();

      await this.pg
        .insert(data)
        .table("posts")
        .returning("*")
        .then(data => {
          res.send(data);
        })
        .catch(error => {
          console.log(error);
          res.status(401).send();
        });
    });

    server.listen(3000, () => {
      console.log(`server up and listening on ${PORT}`);
    });

    return await retryKnex(async () => {
      const self = this;

      await this.pg
        .raw('select 1+1 as result')
        .then(async (resolve, reject) => {
          resolve();
          return true
        })
        .catch((error) => {
          console.log('- error:', error.code);
          setTimeout(retryKnex(), 5000);
        });
    });


  }

  async initialiseTables() {
    const _this = this;
    await this.pg.schema.hasTable("posts").then(function(exists) {
      if (!exists) {
        return _this.pg.schema
          .createTable("posts", function(table) {
            table.increments();
            table.uuid("uuid");
            table.string("content");
            table.string("title");
            table.string("userID");
            table.timestamps(true, true);
          })
          .then(function() {
            console.log("created posts");
          });
      }
    });
    // await this.pg.schema.hasTable("posts").then(function(exists) {
    //   if (exists) {
    //     return _this.pg.schema
    //       .alterTable("posts", function(table) {
    //         table.string("userID");
    //       })
    //       .then(function() {
    //         console.log("created posts");
    //       });
    //   }
    // });

    await this.pg.schema.hasTable("users").then(function(exists) {
      if (!exists) {
        return _this.pg.schema
          .createTable("users", function(table) {
            table.increments();
            table.uuid("uuid");
            table.string("firstName");
            table.string("lastName");
            table.string("dateofbirth");
            table.string("email");
            table.string("password");
            table.timestamps(true, true);
          })
          .then(function() {
            console.log("created users");
          });
      }
    });
  }
}
module.exports = App;

const html = `
<html>
  <head>
    <link href="http://getskeleton.com/dist/css/skeleton.css" rel="stylesheet" />
  </head>
<body>
<div class="container">

<h1> options for the API</h1>
<div class="docs-section" id="grid">

<h4> POST TO /posts</h4>

<p>expects the following data</p>

<pre><code>{
  title: String: title of the post,
  content: String: content of the post
}
</code></pre>

<p>returns a full object with the UUID, id and dates (created and updated)</p>

</div>
<h4>PATCH TO /posts/[id]</h4>

<p>expects the following data
</p>
<pre><code>{
  title: String: title of the post,
  content: String: content of the post
}</code></pre>
<p>
returns a full object with the UUID, id and dates (created and updated)
</p>
<h4>GET to /posts</h4>

<p>returns an array with all the known posts</p>

<h4>GET to /posts/[id]</h4>

<p>where <code>[id]</code> is the id of the post,
returns a single post object</p>

<h4> DELETE to /posts/[id]</h4>

<p>removes the post from the database (use with caution)
</p>
</div>
</body>
</html>
`;
