const clickSound = new Audio("sounds/click.mp3");

function playClick() {
    clickSound.currentTime = 0;
    clickSound.play();
}

const loadingScreen = document.getElementById("loading-screen");
const skinScreen = document.getElementById("skin-screen");
const mainMenu = document.getElementById("main-menu");

setTimeout(() => {

    loadingScreen.classList.add("hidden");
    skinScreen.classList.remove("hidden");

}, 3000);

function selectSkin(skin) {

    skinScreen.classList.add("hidden");
    mainMenu.classList.remove("hidden");

    document.getElementById("skin-display").textContent =
        "Selected Skin: " + skin;

}
``
