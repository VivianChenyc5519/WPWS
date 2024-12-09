// express app
const express = require("express");
const app = express();

app.use(express.static("public"));
app.get("/", function (request, response) {
    response.sendFile(__dirname + "/views/index.html");
});

// HTTP Server
const http = require("http");
//const hostname = "127.0.0.1";
const port = process.env.PORT || 5500;
const server = http.createServer(app);
//server.listen(port, hostname, function() {}); 
server.listen(port, function () {
    console.log("Server is running: Port: " + port);
});

let userRoles = {};
let state = {
    cowPositions: {},
    treePositions: {},
    cowScales: {},
    treeScales: {},
    params: {
        numTrees: 30,
        numCows: 10,
        radius: 100,
        rotationSpeed: 0.01,
    }
}

for (let i = 0; i < state.params.numCows; i++) {
    state.cowScales[i] = getRandomInt(10);
}
for (let i = 0; i < state.params.numTrees; i++) {
    state.treeScales[i] = getRandomInt(35);
}
function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

// socket.io
const socket = require("socket.io");
const io = socket(server);

io.on("connection", function (socket) {
    console.log("New Connection - ID: " + socket.id);
    if (Object.keys(userRoles).length === 0) {
        userRoles[socket.id] = "view-only";
    } else if (Object.keys(userRoles).length === 2) {
        userRoles[socket.id] = 'gui-control';
    } else if (Object.keys(userRoles).length === 1) {
        userRoles[socket.id] = 'tree-control';
    } else {
        userRoles[socket.id] = 'cow-control';
    } // fix later
    //userRoles[socket.id] = "view-only";
    //console.log(state);
    // Notify all clients to add a new cube for the connected client
    socket.emit("initialize", {
        role: userRoles[socket.id],
        state,
    });
    //socket.broadcast.emit("initialize_cube", socket.id);

    socket.on("update-tree", function (index, position) {
        if (userRoles[socket.id] === 'tree-control') {
            state.treePositions[index] = position;
            socket.broadcast.emit("update-tree", { index, position });
        }

    });
    socket.on("update-cow", function (index, position) {
        if (userRoles[socket.id] === 'cow-control') {
            state.cowPositions[index] = position;
            socket.broadcast.emit("update-cow", { index, position, scale });
        } //only for fallen cows

    });
    socket.on("update-gui", function (updatedParams) {
        if (userRoles[socket.id] === "gui-control") {
            state.params = { ...state.params, ...updatedParams };
            // Broadcast to all users
            //console.log("broadcasting", updatedParams);
            socket.broadcast.emit("update-gui", updatedParams);
        }
    });
    socket.on("fall-cow", function (idx) {
        if (userRoles[socket.id] === 'gui-control') {
            socket.broadcast.emit("fall-cow", idx);
        }
    })


    socket.on("disconnect", function () {
        console.log("A user disconnected:", socket.id);
        delete userRoles[socket.id];
    })
});