const express = require('express');
const axios = require('axios');
const cors = require('cors');
const redis = require('redis');
const app = express()
const util = require('util');
const { format } = require('path');
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
const clientHMSET = util.promisify(client.HMSET).bind(client);
const clientHGETALL = util.promisify(client.HGETALL).bind(client)
const clientSET = util.promisify(client.SET).bind(client);
const clientGET = util.promisify(client.GET).bind(client);
const clientTTL = util.promisify(client.TTL).bind(client);
const clientRPUSH = util.promisify(client.RPUSH).bind(client);
const clientEXPIRE = util.promisify(client.EXPIRE).bind(client);


app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: false }));
app.use(cors())


app.get("/", (req, res) => {
    res.send("it's ok")
})

app.get("/testRedis", async (_, res) => {
    try {
        let dummyJson = {}
        dummyJson.name = "Jeff"
        dummyJson.age = 25
        dummyJson.passion = "Technology"
        dummyJson.isAlive = true

        const promises = [clientRPUSH("data:list", JSON.stringify(dummyJson)),
        clientHMSET("data:hash", dummyJson),
        clientSET("data:cache", JSON.stringify(dummyJson), 'EX', 60),
        clientEXPIRE("data:list", 60)]
        const result = await Promise.all(promises)

        console.log(result)

        checkExpiryTime("jeff:cache", "string")
        checkExpiryTime("jeff:list", "list")

        res.send("set ok")

    } catch (error) {
        console.error(error.message)
        res.status(500).send('Server Error')
    }
})

const middleware = async (req, res, next) => {
    try {
        // const data = await clientGET("github:position")
        // if (!data) {
        //     next()
        //     return
        // }
        const redisData = await clientLRANGE("github:positionList", 0, -1);

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

app.get("/getTestRedis", async (_, res) => {
    try {
        const listData = await clientLRANGE("jeff:list", 0, -1);
        const hashData = await clientHGETALL("jeff:hash");

        const listDataUnmarshal = await JSONParse(listData);


        console.log("listDataUnmarshal", listDataUnmarshal);


        res.json({ listData, hashData, listDataUnmarshal })

    } catch (error) {
        console.error(error.message)
        res.status(500).send('Server Error')
    }
})

function JSONParse(data) {
    return new Promise((resolve, reject) => {
        try {
            resolve(JSON.parse(data))
        } catch (error) {
            reject(error)
        }
    })
}


function checkExpiryTime(key, label = "") {
    try {
        const interval = setInterval(async () => {
            let timer = await clientTTL(key)
            console.log("timer " + label, timer)

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
        // await clientSET("github:position", JSON.stringify(response.data), 'EX', 30)
        await clientRPUSH("github:positionList", JSON.stringify(response.data))
        await clientEXPIRE("github:positionList", 120)
        console.log("aa")
        // //will need some time and not recommend for json array
        // for (let i = 0; i < response.data.length; i++) {
        //     await clientHMSET("github:positionHash", response.data[i])
        // }
        checkExpiryTime("github:positionList", "list")
        res.json({ data: response.data })

    } catch (error) {
        console.error(error.message)
        res.status(500).send('Server Error')
    }
})




app.listen(process.env.PORT || 1117, () => {
    console.log("server is running at 1117")
})