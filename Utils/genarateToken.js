const jwt = require('jsonwebtoken');

const genarateToken = (res, email) => {
    const token = jwt.sign(email, "dngfnjnxjmcxnxcn")
    console.log(token);

    return res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        // secure: process.env.NODE_ENV === 'production',
        // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    })
}

module.exports = genarateToken;