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

const userRouter = require("./routes/users");
const adminRouter = require("./routes/admin");

const app = express();

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

let db;
(async () => {
  db = await connectDB();
})();

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

module.exports = app;