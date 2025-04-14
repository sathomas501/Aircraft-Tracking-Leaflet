"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ws_1 = require("ws"); // Correctly import WebSocketServer
var http = require("http");
// Create HTTP server
var server = http.createServer();
var wss = new ws_1.WebSocketServer({ noServer: true }); // Correct WebSocketServer usage
server.on('upgrade', function (req, socket, head) {
    wss.handleUpgrade(req, socket, head, function (ws) {
        wss.emit('connection', ws);
    });
});
wss.on('connection', function (ws) {
    console.log('WebSocket client connected');
    ws.on('message', function (message) {
        console.log('Received message:', message);
        ws.send("Echo: ".concat(message));
    });
    ws.on('close', function () {
        console.log('WebSocket client disconnected');
    });
});
server.listen(3000, function () {
    console.log('Server running on http://localhost:3000');
});
