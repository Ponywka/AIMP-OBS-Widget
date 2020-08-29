// Include libraries
const fs = require('fs')
const http = require('http')

const config = require('./config.json')
console.log(config.copyright)
console.log(`Now we can add http://localhost:${config.port} in OBS`)

// Temp data
let cache = {}

// Output data
let outputdata = {
    "titlename": "Loading",
    "artistname": config.copyright,
    "imageurl": '/public/image.png',
    "is_playing": true
}

let musicData = {}

// Internet request
const netRequest = (params) => {
    return new Promise((resolve, reject) => {
        let content = "";
        let postData = JSON.stringify((params.data) ? params.data : {})
        let headers = (params.headers) ? params.headers : {}
        headers['Content-Type'] = 'application/json'
        headers['Content-Length'] = Buffer.byteLength(postData)
        let req = http.request({
            hostname: params.hostname,
            port: params.port,
            path: params.path,
            method: params.method,
            headers: headers
        }, (res) => {
            res.on('data', (d) => {
                content += d
            })
            res.on('end', () => {
                resolve(content)
            })
        })
        req.on('error', () => {
            reject({ message: "I can't connect to internet. You need internet connection. You can sell your wife for it. https://www.reddit.com/r/copypasta/comments/4zp8hp/hello_am_48_year_man_from_somalia/" })
        })
        req.write(postData)
        req.end()
    })
}

// Loop for get info from AIMP
let worker = setInterval(async function() {
    if (!cache.workRightNow) {
        cache.workRightNow = true
        try {
            let inputData = await netRequest({
                hostname: config.aimpData.address,
                port: config.aimpData.port,
                path: '/RPC_JSON',
                method: 'POST',
                data: { "method": "GetPlayerControlPanelState", "params": {}, "jsonrpc": 2.0 }
            })
            if (inputData != "") {
                let jsonData = JSON.parse(inputData)
                if (!jsonData.error) {
                    if (musicData.id != jsonData.result.track_id) {
                        let musicInfo = JSON.parse(await netRequest({
                            hostname: config.aimpData.address,
                            port: config.aimpData.port,
                            path: '/RPC_JSON',
                            method: 'POST',
                            data: { "method": "GetPlaylistEntryInfo", "params": { "track_id": jsonData.result.track_id }, "jsonrpc": 2.0 }
                        }))

                        if (!musicInfo.error) {
                            musicData.artist = musicInfo.result.artist
                            musicData.title = musicInfo.result.title
                            musicData.id = musicInfo.result.id

                            let musicCover = JSON.parse(await netRequest({
                                hostname: config.aimpData.address,
                                port: config.aimpData.port,
                                path: '/RPC_JSON',
                                method: 'POST',
                                data: { "method": "GetCover", "params": { "track_id": jsonData.result.track_id }, "jsonrpc": 2.0 }
                            }))
                            if (!musicCover.error) {
                                musicData.image = `http://${config.aimpData.address}:${config.aimpData.port}/${musicCover.result.album_cover_uri}`
                            } else {
                                musicData.image = `/public/image.png`
                            }
                        } else {
                            musicData.artist = config.copyright
                            musicData.title = "Loading"
                            musicData.image = '/public/image.png'
                        }
                    }

                    outputdata["titlename"] = musicData.title
                    outputdata["artistname"] = musicData.artist
                    outputdata["imageurl"] = musicData.image
                    outputdata["is_playing"] = jsonData.result.playback_state == 'playing'
                } else {
                    outputdata["is_playing"] = false
                }
            } else {
                outputdata["is_playing"] = false
            }
        } catch (e) {
            console.log();
            console.log();
            console.log();
            console.log("--- Error -------------")
            console.error(e)
            console.log();
        }
        cache.workRightNow = false
    }
}, 1000)

// Write error
const writeError = (response, code, text = "") => {
    response.writeHead(code)
    response.end(`<html><head><h1>${code} | ${text}</h1></head></html>`)
}

// Parse URL for parameters
const parseURLencoded = (url) => {
    let params = {}
    if (url != "") {
        //Cut params to array
        let urldata = url.split("&")
            //Convert string to array
        for (let [key, element] of Object.entries(urldata)) {
            let atrarr = element.split('=')
            let atrname = decodeURI(atrarr[0])
            let atrdata = decodeURI(element.slice(atrname.length + 1))
            params[atrname] = atrdata
        }
    }
    return params
}

//Start server
http.createServer(async function(request, response) {
    let params = {}
        // URL parser
        // Getting only URL
    let urldata = request.url.split('?')
    let url = urldata[0]
        // Getting params
    if (urldata[1]) {
        let strData = request.url.slice(url.length + 1)
        params = parseURLencoded(strData)
    }
    // Delete temp data
    delete urldata
    let isPublicFolder = new RegExp(/\/public\/([\s\S]+?)$/g).exec(url)
    if (isPublicFolder) {
        fs.readFile(`./public/${isPublicFolder[1]}`, function(err, data) {
            if (err) {
                response.end()
            } else {
                response.end(data)
            }
        })
    } else {
        switch (url) {
            case '/':
                fs.readFile('./index.html', function(err, data) {
                    if (err) {
                        response.end()
                    } else {
                        response.end(data.toString())
                    }
                })
                break
            case '/getSong':
                response.writeHead(200, { "Content-Type": "application/json" })
                response.end(JSON.stringify(outputdata))
                break
            default:
                writeError(response, 404, "Not found")
        }
    }
}).on('error', (e) => {
    console.log()
    console.log()
    console.log()
    console.log("--- Error -------------")
    console.error(e)
    console.log();
}).listen(config.port)