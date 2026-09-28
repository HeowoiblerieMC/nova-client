const loadingScreen = document.getElementById("loading-screen");
const skinScreen = document.getElementById("skin-screen");
const mainMenu = document.getElementById("main-menu");

// Click Sound
const clickSound = new Audio("sounds/click.mp3");

function playClick() {

    clickSound.currentTime = 0;
    clickSound.play();

}

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
