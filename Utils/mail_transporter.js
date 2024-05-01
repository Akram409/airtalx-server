const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: "algobot701@gmail.com",
        pass: "jfth qddl nkgp yitb",
    },
});

module.exports = transporter