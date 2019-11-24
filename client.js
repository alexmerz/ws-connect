const Boat = require('./Boat');
const WebsocketClient = require('websocket').client;
const client = new WebsocketClient();


client.on('connectFailed', (err) => {
    console.log(err);
});

client.on('connect', (connection) => {
    console.log('Connected to server');
    connection.on('error', (err) => {
        console.log(err);
    });
    connection.on('close', () => {
        console.log('Connection closed');
    });
    connection.on('message', onWsMessage);

    setInterval(()=> {
        console.log('send');
        if(connection.connected) {
            let command = {
                op : Boat.CMD_RIGHT,
                value : 90
            }
            connection.sendUTF(JSON.stringify(command));
        }
    }, 500);
});

client.connect('ws://localhost:8080/', 'boat');

function onWsMessage(message) {
    console.log(JSON.parse(message.utf8Data));
}