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
    inc: (v) => v == null ? '' : parseInt(v, 10) + 1,
    lookup: (obj, key) => {
      if (Array.isArray(obj) && typeof key === 'number') {
        return obj[key] || null;
      }
      return obj && obj[key] ? obj[key] : null;
    },
    eq: (a, b) => a === b,
    neq: (a, b) => a !== b,
    gte: (a, b) => a >= b,
    length: (arr) => Array.isArray(arr) ? arr.length : 0,
    getByIndex: (arr, index) => {
      if (Array.isArray(arr) && typeof index === 'number') {
        return arr[index] || null;
      }
      return null;
    },
    json: (context) => {
      return JSON.stringify(context);
    }
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
// IMPORTANT for Render (sessions behind proxy)
app.set("trust proxy", 1);
app.use(session({
  secret: process.env.SESSION_SECRET || "zing-zephyr-2025-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true,
    secure: process.env.NODE_ENV === "development",  // true only in production
    sameSite: "lax",
    maxAge: 1000 * 60 * 60*24   // 1 day
  }
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