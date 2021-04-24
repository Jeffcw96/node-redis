const express = require('express');
const axios = require('axios');
const redis = require('redis');
const app = express()
const util = require('util');

const client = redis.createClient({
    host: 'localhost',
    port: 6379,
});

client.on('error', err => {
    console.log('Error ' + err);
});

client.on('connect', () => {
    console.log('Redis is connected');
});

const clientLRANGE = util.promisify(client.LRANGE).bind(client);
const clientTTL = util.promisify(client.TTL).bind(client);
const clientRPUSH = util.promisify(client.RPUSH).bind(client);
const clientEXPIRE = util.promisify(client.EXPIRE).bind(client);


app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: false }));

const middleware = async (req, res, next) => {
    try {
        const redisData = await clientLRANGE("github:jobList", 0, -1);

        if (redisData.length === 0) {
            next()
            return
        }

        const data = await JSONParse(redisData);
        res.json({ data })

    } catch (error) {
        console.error(error.message)
        res.status(500).send('Server Error')
    }
}

function JSONParse(data) {
    return new Promise((resolve, reject) => {
        try {
            resolve(JSON.parse(data))
        } catch (error) {
            reject(error)
        }
    })
}


function checkExpiryTime(key) {
    try {
        const interval = setInterval(async () => {
            let timer = await clientTTL(key)
            console.log("timer ", timer)

            if (timer === -2) {
                clearInterval(interval)
            }
        }, 1000);
    } catch (error) {
        console.error(error.message)
    }
}

app.get("/getGithubJobListing", middleware, async (req, res) => {
    try {
        const url = `https://jobs.github.com/positions.json?description=api`
        const response = await axios.get(url)

        await clientRPUSH("github:jobList", JSON.stringify(response.data))
        await clientEXPIRE("github:jobList", 120)

        checkExpiryTime("github:jobList", "list")
        res.json({ data: response.data })

    } catch (error) {
        console.error(error.message)
        res.status(500).send('Server Error')
    }
})




app.listen(process.env.PORT || 5000, () => {
    console.log("server is running at 5000")
})