const { emailQueue } = require("../queues/emailNewsletter");

const queueConfirmationEmail = (subscriber) =>
  emailQueue.add("newsletter-confirmation", {
    subscriberId: subscriber._id.toString(),
    email: subscriber.email,
  });

module.exports = { queueConfirmationEmail };