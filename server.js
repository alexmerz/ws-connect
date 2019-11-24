const http = require('http');
const WebsocketServer = require('websocket').server;
const Boat = require('./Boat.js');

const server = http.createServer((req, res) => {});
server.listen(8080, () => {console.log('Server started')});
const wsServer = new WebsocketServer({
    httpServer : server,
    ignoreXForwardedFor: true,
    disableNagleAlgorithm : true // disable batching messages!
});

Boat.init();
wsServer.on('request', (req) => {
    let connection = req.accept('boat', req.origin);
    console.log('New Connection');

    connection.on('message', (message) => {
        Boat.onMessage(message.utf8Data, (response)=>{connection.sendUTF(response)});
    });
    connection.on('close', (reason, desc) => {
        console.log('Disconnect be client');
        connection = null;
    });
});


