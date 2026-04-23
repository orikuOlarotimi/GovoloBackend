const express = require("express")
const router = express.Router()

const { user } = require("../controllers/userControler")

router.post("/register", user);

module.exports = router
