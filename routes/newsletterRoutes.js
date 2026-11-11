const router = require("express").Router();
const {
  subscribe,
  unsubscribe,
} = require("../controllers/newsletterController");

router.post("/subscribe", subscribe);
router.post("/unsubscribe/:id/:token", unsubscribe);

module.exports = router;
