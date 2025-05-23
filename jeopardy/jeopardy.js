// jeopardy.js

// Constants
const NUM_CATEGORIES = 6;
const NUM_QUESTIONS_PER_CAT = 5;
const API_BASE_URL = "https://projects.springboard.com/jeopardy/api";

// Data structure to hold categories and clues
let categories = [];

/**
 * Fetches NUM_CATEGORIES random category IDs from the API.
 * @returns {Promise<number[]>} Array of category IDs
 */
async function getCategoryIds() {
    try {
        const response = await axios.get(`${API_BASE_URL}/categories?count=100`);
        const allCategories = response.data;
        const randomCategories = _.sampleSize(allCategories, NUM_CATEGORIES);
        return randomCategories.map(cat => cat.id);
    } catch (error) {
        console.error("Error fetching category IDs:", error);
        alert("Failed to load categories. Please try again.");
    }
}

/**
 * Fetches category data for a given category ID.
 * @param {number} catId - Category ID
 * @returns {Promise<Object>} Category object with title and clues
 */
async function getCategory(catId) {
    try {
        const response = await axios.get(`${API_BASE_URL}/category?id=${catId}`);
        const data = response.data;
        const allClues = data.clues;
        const randomClues = _.sampleSize(allClues, NUM_QUESTIONS_PER_CAT);
        const clues = randomClues.map(clue => ({
            question: clue.question,
            answer: clue.answer,
            showing: null
        }));
        return { title: data.title, clues };
    } catch (error) {
        console.error(`Error fetching category data for ID ${catId}:`, error);
        alert("Failed to load category data. Please try again.");
    }
}

/**
 * Populates the HTML table with categories and clues.
 */
async function fillTable() {
    // Clear existing table content
    $("#categories-row").empty();
    $("#clues-body").empty();

    // Populate category headers
    for (let category of categories) {
        $("#categories-row").append(`<th>${category.title}</th>`);
    }

    // Populate clue cells
    for (let i = 0; i < NUM_QUESTIONS_PER_CAT; i++) {
        const $row = $("<tr>");
        for (let j = 0; j < NUM_CATEGORIES; j++) {
            $row.append(`<td data-category="${j}" data-clue="${i}">?</td>`);
        }
        $("#clues-body").append($row);
    }
}

/**
 * Handles click events on clue cells to show question or answer.
 * @param {Event} evt - Click event
 */
function handleClick(evt) {
    const $cell = $(evt.target);
    const catIndex = $cell.data("category");
    const clueIndex = $cell.data("clue");
    const clue = categories[catIndex].clues[clueIndex];

    if (clue.showing === null) {
        // Show question
        $cell.text(clue.question);
        clue.showing = "question";
    } else if (clue.showing === "question") {
        // Show answer
        $cell.text(clue.answer);
        clue.showing = "answer";
    }
    // If already showing answer, do nothing
}

/**
 * Displays the loading spinner and disables the restart button.
 */
function showLoadingView() {
    $("#loading").show();
    $("#restart").prop("disabled", true);
}

/**
 * Hides the loading spinner and enables the restart button.
 */
function hideLoadingView() {
    $("#loading").hide();
    $("#restart").prop("disabled", false);
}

/**
 * Initializes the game by fetching categories and clues, then populating the table.
 */
async function setupAndStart() {
    showLoadingView();
    const categoryIds = await getCategoryIds();
    categories = [];

    for (let id of categoryIds) {
        const category = await getCategory(id);
        if (category) {
            categories.push(category);
        }
    }

    await fillTable();
    hideLoadingView();
}

/**
 * Sets up event listeners and starts the game on page load.
 */
$(document).ready(function () {
    // Start the game
    setupAndStart();

    // Handle clue cell clicks
    $("#jeopardy").on("click", "td", handleClick);

    // Handle restart button click
    $("#restart").on("click", setupAndStart);
});
