const loadingScreen = document.getElementById("loading-screen");
const skinScreen = document.getElementById("skin-screen");
const usernameScreen = document.getElementById("username-screen");
const mainMenu = document.getElementById("main-menu");

const singleplayerScreen =
    document.getElementById("singleplayer-screen");

const createWorldScreen =
    document.getElementById("create-world-screen");

let selectedSkin = "";
let worlds = [];

// Loading
setTimeout(() => {
    loadingScreen.classList.add("hidden");
    skinScreen.classList.remove("hidden");
}, 3000);

// Skin Selection
function selectSkin(skin) {

    selectedSkin = skin;

    skinScreen.classList.add("hidden");
    usernameScreen.classList.remove("hidden");

}

// Username Setup
function saveUsername() {

    const username =
        document.getElementById("username-input").value;

    if (username === "") {
        alert("Enter a username!");
        return;
    }

    document.getElementById("username-display")
        .textContent = "👤 Username: " + username;

    document.getElementById("skin-display")
        .textContent = "🎭 Skin: " + selectedSkin;

    usernameScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");

}

// Singleplayer
function openSingleplayer() {

    mainMenu.classList.add("hidden");
    singleplayerScreen.classList.remove("hidden");

}

function backToMenu() {

    singleplayerScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");

}

// Create World
function openCreateWorld() {

    singleplayerScreen.classList.add("hidden");
    createWorldScreen.classList.remove("hidden");

}

function backToSingleplayer() {

    createWorldScreen.classList.add("hidden");
    singleplayerScreen.classList.remove("hidden");

}

function createWorld() {

    const worldName =
        document.getElementById("world-name").value;

    if (worldName === "") {
        alert("Enter a world name!");
        return;
    }

    worlds.push(worldName);

    updateWorldList();

}

function updateWorldList() {

    let html = "<h3>🌍 Worlds</h3>";

    worlds.forEach(world => {

        html += `
        <div style="margin:10px;">
            ${world}
            <button onclick="playWorld('${world}')">
                Play
            </button>

            <button onclick="deleteWorld('${world}')">
                Delete
            </button>
        </div>
        `;

    });

    document.getElementById("world-message")
        .innerHTML = html;

}

function playWorld(world) {

    alert("Launching: " + world);

}

function deleteWorld(world) {

    worlds = worlds.filter(w => w !== world);

    updateWorldList();

}
