var http = require('http').Server(app);
var WebSocketServer = require('ws').Server;
var express = require('express');
var app = express();
var PORT = 443;

var wss = new WebSocketServer({port: PORT});

var messages = [];
var clientSockets = new Array();
var jsonDeviceInfo = new Array();

var serverSocket = null;
var masterSocket = null;

var pendingCommand = {};

app.get('/', function(req, res){
    res.sendfile('index.html');
});
app.use("/css", express.static(__dirname + '/css'));

wss.on('connection', function (ws) {
    console.log("Device is connected");    
    ws.on('message', function (message) {        
        message = JSON.parse(message);
        if(message.action == "register_server")
        {            
            console.log("Receive register server request");
            registerServer(ws);
        } else if(message.action == "register_client"){
            console.log("Receive register client request");
            registerClient(ws, message);
        } else if(message.action == "execute_command"){
            console.log("Execute command");
            executeCommand(message);
        } else if(message.action == "execute_result"){
            console.log("Execute result");
            executeResult();
        }       
    });

    ws.on('close', function(){
        console.log("Disconnected")  
        for(var key in clientSockets)
        {            
            if(clientSockets[key] == ws)
            {
                jsonDeviceInfo[key].state = 0;   
                if(jsonDeviceInfo[key].master == true)
                    masterSocket = null;                     
                console.log(jsonDeviceInfo);
                return;        
            }
        }

        if(ws == serverSocket)
            serverSocket = null;
    });
});

var executeResult = function(){
    var resultPacket = {};
    resultPacket.action = "execute_result";
    resultPacket.result = "Success";
    serverSocket.send(JSON.stringify(resultPacket))        
}
var executeCommand = function(message)
{
    console.log(message);            
    for(var key in jsonDeviceInfo)
    {
        if(key == message.nick_name)
        {
            if(jsonDeviceInfo[key].state == 1)
            {
                var clientSocket = clientSockets[message.nick_name];
                var commandPacket = {};
                commandPacket.action = "execute_command";
                commandPacket.command = message.command;
                commandPacket.url = message.url;
                clientSocket.send(JSON.stringify(commandPacket));
                console.log("Send data to " + message.nick_name + " successfully.");
                return;
            }
        }
    }

    if(masterSocket != null)
    {
        var commandPacket = {};        
        commandPacket.action = "wakeup_device";
        commandPacket.nick_name = message.nick_name;     
        masterSocket.send(JSON.stringify(commandPacket));               
        console.log("Send data to master device to wake up " + message.nick_name);
        pendingCommand["nick_name"] = message.nick_name;
        pendingCommand["command"] = message.command;
        pendingCommand["url"] = message.url;
        pendingCommand["state"] = "pending";
        return;
    }
    console.log("Failure");

    var resultPacket = {};
    resultPacket.action = "execute_result";
    resultPacket.result = "Failure";
    serverSocket.send(JSON.stringify(resultPacket))        
}

var registerServer = function(ws)
{    
    serverSocket = ws;
    var keyArray = new Array();
    for(var key in jsonDeviceInfo)
    {
        keyArray.push(key);
    }
    var message = {};
    message.action = "init_devices";
    message.device_list = keyArray;

    serverSocket.send(JSON.stringify(message));
    console.log("Send device list to server interface: " + JSON.stringify(message));
} 

var registerClient = function(ws, message)
{  
    console.log("RegiserClient");
    var existFlag = false;
    for(var key in jsonDeviceInfo)
    {
        if(key == message.nick_name)
            existFlag = true;
    }    
    if(!existFlag)
    {
        var deviceInfo = new Array();
        deviceInfo.master = message.master;
        deviceInfo.state = 1;        
        jsonDeviceInfo[message.nick_name] = deviceInfo;        
        console.log("Add device");
         if(serverSocket != null)
         {
            var data = {};
            data.action = "add_device";  
            data.nick_name = message.nick_name;
            serverSocket.send(JSON.stringify(data));
         }
    }
    else{
        jsonDeviceInfo[message.nick_name].state = 1;        
        console.log("Update device");
    }        
    clientSockets[message.nick_name] = ws;
    if(message.master == true)
        masterSocket = ws;
            
    if(message.nick_name == pendingCommand.nick_name && pendingCommand.state == "pending")
    {
        var data = {};
        data.action = "execute_command";
        data.command = pendingCommand.command;
        data.url = pendingCommand.url;
        ws.send(JSON.stringify(data));       
        pendingCommand.state = "done";        
        console.log("Send pendding comment to " + data.nick_name + " successfully.");
    }
}

http.listen(process.env.PORT || 3000, function(){
    console.log('listening on', http.address().port);
});
console.log('Server listening at port %d', PORT);
