const WebSocket = require('ws');

var keys = {};
var percentageTexts = new Array();

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
var renderer = new THREE.WebGLRenderer({canvas: renderWindow});
renderer.setSize(400, 400);

function makeArrow(color) {
    var group = new THREE.Group();
    var boxGeometry = new THREE.BoxGeometry(1, 0.07, 0.07);
    var coneGeometry = new THREE.ConeGeometry(0.1, 0.2, 32);
    var material = new THREE.MeshBasicMaterial({color: color});

    var box = new THREE.Mesh(boxGeometry, material);
    var cone = new THREE.Mesh(coneGeometry, material);
    box.position.set(0.5, 0, 0);
    cone.position.set(1, 0, 0);
    cone.rotation.set(0, 0, -Math.PI / 2);
    group.add(box);
    group.add(cone);
    return group;
}

function makeAxes(color1=0xFF2222, color2=0x22FF22, color3=0x2222FF) {
    var group = new THREE.Group();
    var arrowX = makeArrow(color1);
    var arrowY = makeArrow(color2);
    var arrowZ = makeArrow(color3);
    arrowY.rotation.set(0, 0, Math.PI / 2);
    arrowZ.rotation.set(0, Math.PI / 2, 0);
    group.add(arrowX);
    group.add(arrowY);
    group.add(arrowZ);
    return group;
}

var axes = makeAxes();
scene.add(axes);
camera.position.set(1.5, 1.5, -1.5);
camera.lookAt(0, 0, 0);
console.log("three.js setup done");

function getFrame(roll=0, pitch=0, yaw=0) {
    return function() {
        var euler = new THREE.Euler(roll, pitch, yaw, 'XYZ');
        axes.applyEuler(euler);
        renderer.render(scene, camera);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function connect(path) {
    const ws = new WebSocket("ws://" + path);
    while (true) {
        await sleep(1000);
        if (ws.readyState === WebSocket.OPEN) {
            console.log("Connected");
            return ws;
        }
    }
}

document.addEventListener("keydown", function onDown(event) {
    keys[event.key.toLowerCase()] = true;
});

document.addEventListener("keyup", function onUp(event) {
    keys[event.key.toLowerCase()] = false;
}); 

function determineCommand(positive, negative) {
    if (positive == negative) return 0;
    else if (positive == undefined) return (negative ? -1 : 0);
    else if (negative == undefined) return (positive ? 1 : 0);
    else if (positive) return 1;
    return -1;
}

function dataSender(client) {
    var message = {
        "time": Math.round((new Date()).getTime()), // in milliseconds since epoch
        "pitch": determineCommand(keys["w"], keys["s"]),
        "yaw": determineCommand(keys['q'], keys['e']),
        "roll": determineCommand(keys['a'], keys['d']),
        "throttle": determineCommand(keys[' '], keys['shift']) // spacebar and shift
    };
    client.send(JSON.stringify(message));
    console.log("Sent");
}

function percentageUpdate(actualValues) {
    for (i = 0; i < 4; i += 1) {
        percentageTexts[i].innerHTML = actualValues[i].toString() + "%";
        console.log(actualValues);
        progressBars[i].setAttribute("style", "width: "+(actualValues[i].toString() + "%;"))
    }
}

function responseHandler(event) {
    console.log("Recieved");
    var data = JSON.parse(event.data);
    motorSpeeds = new Array();
    data.state.motors.forEach(function (item, index) {
        motorSpeeds[index] = item;
    });
    percentageUpdate(motorSpeeds);
    requestAnimationFrame(getFrame(data.orientation.roll, data.orientation.pitch, data.orientation.yaw));
}

async function loop(client) {
    while (true) {
        if (client.readyState != 1) {
            console.log("Connection failure");
            return;
        }
        dataSender(client);
        await sleep(500);
    }
}

async function formHandler(form) {
    var ip = form.ip.value;

    if (ip.length == 0) {
        alert("No IP specified");
    }

    var client = await connect(ip);
    document.getElementById("connection-input").setAttribute("style", "border-color: green;");
    
    console.log("Stating loop");
    client.onmessage = responseHandler;
    loop(client);
}

async function setup() {
    console.log("Initializing");
    progressBars = document.getElementsByClassName("progress-bar-percentage");

    for (let wrapper of progressBars) {
        percentageTexts.push(wrapper.getElementsByTagName("span")[0]);
    }
}

window.onload = function() {
    setup();    
    requestAnimationFrame(getFrame(0, 0, 0));
}