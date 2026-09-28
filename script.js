const loadingScreen = document.getElementById("loading-screen");
const skinScreen = document.getElementById("skin-screen");
const mainMenu = document.getElementById("main-menu");
const singleplayerScreen = document.getElementById("singleplayer-screen");

// Loading Screen
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

// Open Singleplayer
function openSingleplayer() {

    mainMenu.classList.add("hidden");
    singleplayerScreen.classList.remove("hidden");

}

// Back To Menu
function backToMenu() {

    singleplayerScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");

}
