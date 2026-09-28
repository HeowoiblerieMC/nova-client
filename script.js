const loadingScreen =
    document.getElementById("loading-screen");

const skinScreen =
    document.getElementById("skin-screen");

const mainMenu =
    document.getElementById("main-menu");

const singleplayerScreen =
    document.getElementById("singleplayer-screen");

const createWorldScreen =
    document.getElementById("create-world-screen");


// Loading
setTimeout(() => {

    loadingScreen.classList.add("hidden");
    skinScreen.classList.remove("hidden");

}, 3000);


// Skin Selection
function selectSkin(skin) {

    skinScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");

    document.getElementById("skin-display").textContent =
        "Selected Skin: " + skin;

}


// Singleplayer
function openSingleplayer() {

    mainMenu.classList.add("hidden");
    singleplayerScreen.classList.remove("hidden");

}


// Back To Menu
function backToMenu() {

    singleplayerScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");

}


// Create World Screen
function openCreateWorld() {

    singleplayerScreen.classList.add("hidden");
    createWorldScreen.classList.remove("hidden");

}


// Back To Singleplayer
function backToSingleplayer() {

    createWorldScreen.classList.add("hidden");
    singleplayerScreen.classList.remove("hidden");

}


// Create World
function createWorld() {

    const worldName =
        document.getElementById("world-name").value;

    if (worldName === "") {

        document.getElementById("world-message")
            .textContent = "Please enter a world name.";

        return;

    }

    document.getElementById("world-message")
        .textContent =
        "✅ World Created: " + worldName;

}
