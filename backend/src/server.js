const express = require("express");
const http = require("http");
const bodyParser = require("body-parser");
const cors = require("cors");
const uuidV1 = require("uuid");
const emoji = require("node-emoji");

const app = express();
const server = http.Server(app);
const PORT = 3000;

class App {
  constructor(opts) {
    this.pg = require("knex")({
      client: "pg",
      connection: process.env.PG_CONNECTION_STRING
    });

    const _this = this;

    this.pg.raw("select 1+1 as result").then(function() {
      _this.initialiseTables();
    });

    this.start = this.start.bind(this);

    this.app = express();
    this.s = http.Server(this.app);
  }

  async start() {
    app.use(bodyParser.json()); // to support JSON-encoded bodies

    app.use(cors({ credentials: false, origin: "*" }));

    app.get("/", async (req, res, next) => {
      res.send(html);
    });

    app.get("/posts", async (req, res, next) => {
      await this.pg
        .select("*")
        .table("posts")
        .then(data => {
          res.send(data);
        })
        .catch(error => {
          console.log(error);
          res.status(401).send();
        });
    });
    app.get("/posts/:id", async (req, res, next) => {
      await this.pg
        .select("*")
        .where({ id: req.params.id })
        .table("posts")
        .then(data => {
          res.send(data);
        })
        .catch(error => {
          console.log(error);
          res.status(401).send();
        });
    });
    app.delete("/posts/:id", async (req, res, next) => {
      await this.pg
        .del()
        .where({ id: req.params.id })
        .table("posts")
        .then(() => {
          res.status(200).send("OK");
        })
        .catch(error => {
          console.log(error);
          res.status(401).send();
        });
    });

    app.patch("/posts/:id", async (req, res, next) => {
      const data = {
        title: req.body.title,
        content: req.body.content
      };

      await this.pg
        .update(data)
        .where({ id: req.params.id })
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
    app.post("/posts", async (req, res, next) => {
      const data = {
        title: req.body.title,
        content: req.body.content
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
            table.timestamps(true, true);
          })
          .then(function() {
            console.log("created posts");
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
