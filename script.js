const loadingScreen =
document.getElementById("loading-screen");

const skinScreen =
document.getElementById("skin-screen");

const usernameScreen =
document.getElementById("username-screen");

const mainMenu =
document.getElementById("main-menu");

const singleplayerScreen =
document.getElementById("singleplayer-screen");

const createWorldScreen =
document.getElementById("create-world-screen");

const worldScreen =
document.getElementById("world-screen");

const multiplayerScreen =
document.getElementById("multiplayer-screen");

const settingsScreen =
document.getElementById("settings-screen");

const profileScreen =
document.getElementById("profile-screen");

let selectedSkin = "";
let username = "";

let worlds =
JSON.parse(
localStorage.getItem(
"worlds"
)
) || [];

let posX = 0;
let posY = 64;
let posZ = 0;

let wood = 0;
let treeExists = true;

// Loading

setTimeout(() => {

    loadingScreen.classList.add(
        "hidden"
    );

    skinScreen.classList.remove(
        "hidden"
    );

}, 3000);

// Skin

function selectSkin(skin) {

    selectedSkin = skin;

    skinScreen.classList.add(
        "hidden"
    );

    usernameScreen.classList.remove(
        "hidden"
    );

}

// Username

function saveUsername() {

    username =
    document.getElementById(
        "username-input"
    ).value;

    if (username === "") {

        alert(
            "Enter a username"
        );

        return;

    }

    document.getElementById(
        "username-display"
    ).textContent =
    "👤 Username: " +
    username;

    document.getElementById(
        "skin-display"
    ).textContent =
    "🎭 Skin: " +
    selectedSkin;

    usernameScreen.classList.add(
        "hidden"
    );

    mainMenu.classList.remove(
        "hidden"
    );

}

// Singleplayer

function openSingleplayer() {

    mainMenu.classList.add(
        "hidden"
    );

    singleplayerScreen.classList.remove(
        "hidden"
    );

}

function backToMenu() {

    singleplayerScreen.classList.add(
        "hidden"
    );

    mainMenu.classList.remove(
        "hidden"
    );

}

// Create World

function openCreateWorld() {

    singleplayerScreen.classList.add(
        "hidden"
    );

    createWorldScreen.classList.remove(
        "hidden"
    );

}

function backToSingleplayer() {

    createWorldScreen.classList.add(
        "hidden"
    );

    singleplayerScreen.classList.remove(
        "hidden"
    );

}

function createWorld() {

    const worldName =
    document.getElementById(
        "world-name"
    ).value;

    if (worldName === "") {

        alert(
            "Enter a world name"
        );

        return;

    }

    worlds.push(
        worldName
    );

    localStorage.setItem(
        "worlds",
        JSON.stringify(
            worlds
        )
    );

    updateWorldList();

    createWorldScreen.classList.add(
        "hidden"
    );

    singleplayerScreen.classList.remove(
        "hidden"
    );

}

function updateWorldList() {

    let html = "";

    worlds.forEach(world => {

        html += `
        <div>

            <b>${world}</b>

            <button onclick="playWorld('${world}')">
                Play
            </button>

            <button onclick="deleteWorld('${world}')">
                Delete
            </button>

        </div>
        `;

    });

    document.getElementById(
        "world-list"
    ).innerHTML = html;

}

// PLAY

function playWorld(world) {

    localStorage.setItem(
        "selectedWorld",
        world
    );

    window.location.href =
    "test3d.html";

}

// DELETE

function deleteWorld(world) {

    worlds =
    worlds.filter(
        w => w !== world
    );

    localStorage.setItem(
        "worlds",
        JSON.stringify(
            worlds
        )
    );

    updateWorldList();

}

// Legacy World Functions

function updateCoords() {

    const coords =
    document.getElementById(
        "coords"
    );

    if (!coords) return;

    coords.textContent =
    "X: " +
    posX +
    " | Y: " +
    posY +
    " | Z: " +
    posZ;

}

function moveNorth() {

    posZ--;

    updateCoords();

}

function moveSouth() {

    posZ++;

    updateCoords();

}

function moveWest() {

    posX--;

    updateCoords();

}

function moveEast() {

    posX++;

    updateCoords();

}

function mineTree() {

    if (!treeExists) {

        alert(
            "No tree here!"
        );

        return;

    }

    wood++;

    treeExists = false;

    const viewport =
    document.getElementById(
        "viewport"
    );

    const inventory =
    document.getElementById(
        "inventory"
    );

    if (viewport) {

        viewport.textContent =
        "⬜";

    }

    if (inventory) {

        inventory.textContent =
        "🎒 Wood: " + wood;

    }

}

function pauseWorld() {

    if (!worldScreen) return;

    worldScreen.classList.add(
        "hidden"
    );

    mainMenu.classList.remove(
        "hidden"
    );

}

// Multiplayer

function openMultiplayer() {

    mainMenu.classList.add(
        "hidden"
    );

    multiplayerScreen.classList.remove(
        "hidden"
    );

}

function closeMultiplayer() {

    multiplayerScreen.classList.add(
        "hidden"
    );

    mainMenu.classList.remove(
        "hidden"
    );

}

// Settings

function openSettings() {

    mainMenu.classList.add(
        "hidden"
    );

    settingsScreen.classList.remove(
        "hidden"
    );

}

function closeSettings() {

    settingsScreen.classList.add(
        "hidden"
    );

    mainMenu.classList.remove(
        "hidden"
    );

}

// Profile

function openProfile() {

    document.getElementById(
        "profile-username"
    ).textContent =
    "Username: " +
    username;

    document.getElementById(
        "profile-skin"
    ).textContent =
    "Skin: " +
    selectedSkin;

    document.getElementById(
        "profile-worlds"
    ).textContent =
    "Worlds: " +
    worlds.length;

    mainMenu.classList.add(
        "hidden"
    );

    profileScreen.classList.remove(
        "hidden"
    );

}

function closeProfile() {

    profileScreen.classList.add(
        "hidden"
    );

    mainMenu.classList.remove(
        "hidden"
    );

}

// Start

updateWorldList();
