const express = require("express");
const router = express.Router();

router.get("/", (req, res, next) => {
  res.render("360", {
     title: "Turntable"
  });
});

module.exports = router;