// var createError = require("http-errors");
// var express = require("express");
// var connectDB = require("./config/db");
// var path = require("path");
// var cookieParser = require("cookie-parser");
// var logger = require("morgan");
// var session = require("express-session");
// const Handlebars = require("handlebars");
// const { create } = require("express-handlebars"); // or require('express-handlebars')

// var { engine } = require("express-handlebars");
// const {
//   allowInsecurePrototypeAccess,
// } = require("@handlebars/allow-prototype-access");
// var fileUpload = require("express-fileupload");

// const { extname } = require("path/posix");
// const { log } = require("console");

// var app = express();
// const PORT = process.env.PORT || 3000;
// const hbs = create({
//   extname: ".hbs",
//   helpers: {
//     inc: (v) => {
//       if (v == null) return "";
//       return parseInt(v, 10) + 1;
//     },
//   },
// });

// // view engine setup
// app.set("view engine", "hbs");
// app.set("views", path.join(__dirname, "views"));
// app.engine(
//   "hbs",
//   engine({
//     extname: "hbs",
//     defaultLayout: "layout",
//     handlebars: allowInsecurePrototypeAccess(Handlebars),
//     layoutsDir: __dirname + "/views/layout/",
//     partialsDir: __dirname + "/views/partials/",
//   })
// );

// app.use(fileUpload());
// app.use(logger("dev"));
// app.use(express.json());
// app.use(session({ secret: "key", cookie: { maxAge: 300000 } }));

// let db;
// (async () => {
//   db = await connectDB();
// })();

// // app.listen(PORT,()=>{
// //   console.log("server running on: ${PORT}");
// // })

// app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, "public")));

// var userRouter = require("./routes/users");
// var adminRouter = require("./routes/admin");
// const { handlebars } = require("hbs");

// app.use("/admin", adminRouter);
// app.use("/", userRouter);

// // catch 404 and forward to error handler
// app.use(function (req, res, next) {
//   next(createError(404));
// });

// // error handler
// app.use(function (err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get("env") === "development" ? err : {};

//   // render the error page
//   res.status(err.status || 500);
//   res.render("error");
// });

// module.exports = app;


const express = require("express");
const connectDB = require("./config/db");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const { engine } = require("express-handlebars");
const Handlebars = require("handlebars");
const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access');
require('dotenv').config();

const userRouter = require("./routes/users");
const adminRouter = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

// Handlebars setup
app.engine("hbs", engine({
  extname: "hbs",
  defaultLayout: "layout",
  layoutsDir: __dirname + "/views/layout/",
  partialsDir: __dirname + "/views/partials/",
  handlebars: allowInsecurePrototypeAccess(Handlebars),
  helpers: {
    inc: (v) => v == null ? '' : parseInt(v, 10) + 1
  }
}));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(fileUpload());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: "key",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 300000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

// Error handling
app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// Start server after DB connects
const startServer = async () => {
  try {
    const db = await connectDB();
    console.log("Database ready:", db.databaseName);

    // Optionally pass db to routers
    app.locals.db = db; // can access in routes via req.app.locals.db

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err);
  }
};

startServer();

module.exports = app;