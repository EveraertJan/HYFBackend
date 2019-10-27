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
      res.send(200, { message: "Server is running" });
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
    await this.pg.schema.hasTable("posts").then(function(exists) {
      if (!exists) {
        return knex.schema
          .createTable("posts", function(t) {
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
